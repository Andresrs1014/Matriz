# Contexto del Proyecto: Matriz de Priorización

> Archivo para uso exclusivo de Claude Code. No se sube al repositorio (.gitignore).
> Última actualización: 2026-03-31

---

## 1. ¿Qué es este proyecto?

**Matriz** es una aplicación web interna para gestión y priorización de proyectos de mejora, usada por IMC CARGO INTERNATIONAL SAS. Permite:

- Registrar ideas/proyectos de mejora (manual o desde Microsoft Lists via Power Automate)
- Evaluar cada proyecto usando una **matriz impacto/esfuerzo** con preguntas ponderadas
- Calcular **ROI** en horas-hombre ahorradas y valor en COP
- Clasificar proyectos en cuadrantes estratégicos
- Visualizar resultados en scatter plots interactivos

**Stack:**
- **Backend**: Python 3.11 + FastAPI + SQLModel + SQLite + Uvicorn
- **Frontend**: React 19 + TypeScript + Vite 7 + Tailwind CSS v3 + Zustand
- **Comunicación tiempo real**: WebSocket nativo (no Socket.io)
- **Auth**: JWT (HS256) + bcrypt

---

## 2. Jerarquía de Roles

```
usuario (0)      → Solo ve sus propios proyectos (/mis-proyectos)
coordinador (1)  → Puede crear usuarios, ver todos los proyectos
admin (2)        → Puede escalar, evaluar, completar ROI
superadmin (3)   → Aprueba, asigna preguntas, provee salarios, gestiona settings
```

**Guards en backend** (`backend/app/core/dependencies.py`):
- `require_coordinador` → rol >= 1
- `require_admin` → rol >= 2
- `require_superadmin` → rol == 3

---

## 3. Flujo Completo de un Proyecto (State Machine)

```
[Creación]
    usuario/admin crea proyecto → estado: pendiente_revision

[Paso 1] Admin: POST /projects/{id}/escalar
    → estado: escalado

[Paso 2] Superadmin: POST /projects/{id}/superaprobar
    → asigna preguntas de matriz (categoria + custom)
    → estado: preguntas_asignadas

[Paso 3] Admin: POST /projects/{id}/iniciar-evaluacion
    → estado: en_evaluacion

[Paso 4] Admin: POST /matrix/evaluate/{id}
    → envía respuestas (1-5) para cada pregunta
    → sistema calcula impacto/esfuerzo y determina cuadrante

[Paso 5] Admin: POST /projects/{id}/marcar-evaluado
    → estado: evaluado

[Paso 6] Superadmin: POST /roi/{id}/parte1
    → ingresa cargo, sede, salario_base (PRIVADO - solo superadmin lo ve)
    → sistema calcula valor_hora_hombre
    → estado: pendiente_salario

[Paso 7] Admin: PATCH /roi/{id}/parte2
    → ingresa num_personas, horas_proceso_actual, horas_proceso_nuevo
    → estado: calculando_roi

[Paso 8] Sistema auto-calcula ROI y cierra
    → POST /projects/{id}/completar-roi
    → estado: aprobado_final

[En cualquier paso] POST /projects/{id}/rechazar → estado: rechazado
```

**Transiciones válidas** (definidas en `project_service.py`):
```python
VALID_TRANSITIONS = {
    "pendiente_revision": ["escalado", "rechazado"],
    "escalado": ["preguntas_asignadas", "rechazado"],
    "preguntas_asignadas": ["en_evaluacion", "rechazado"],
    "en_evaluacion": ["evaluado", "rechazado"],
    "evaluado": ["pendiente_salario", "rechazado"],
    "pendiente_salario": ["calculando_roi", "rechazado"],
    "calculando_roi": ["aprobado_final", "rechazado"],
}
```

---

## 4. Modelo de Datos Completo

### User
```
id, email (unique), full_name, hashed_password, is_active
role: usuario | coordinador | admin | superadmin
area, created_at, deactivated_at
```

### Project
```
id, title, description, status, source (manual | list), owner_id
# OKR
okr_objectives, key_results, key_actions, resources, five_whys, measurement_methods
# Submission
submitted_by_name, collaborators_json
# Approval
approved_by, approved_at (admin escaló)
final_approved_by, final_approved_at (superadmin aprobó)
# Microsoft
ms_list_id (para proyectos desde Power Automate)
```

### MatrixQuestion (catálogo global)
```
id, category_id, axis (impact | effort), text, weight (float), order, is_active
```

### QuestionCategory (paquetes de preguntas)
```
id, name, description, is_active, is_default, created_at
```

### ProjectQuestion (preguntas asignadas a un proyecto específico)
```
id, project_id, question_text, axis, source_question_id (FK opcional), created_by, created_at
```

### MatrixEvaluation
```
id, project_id, category_id
impact_score (0-100), effort_score (0-100)
quadrant: esencial | estrategico | indiferente | lujo
notes, created_at
```

### EvaluationResponse
```
id, evaluation_id
question_id (FK → MatrixQuestion, opcional)
project_question_id (FK → ProjectQuestion, opcional)
value (1-5)
```

### ROIEvaluation
```
id, project_id
# Parte 1 - Superadmin (privado)
cargo, sede, salario_base
valor_quincena, valor_dia, valor_hora_hombre (calculados)
# Parte 2 - Admin
num_personas, horas_proceso_actual, horas_proceso_nuevo
# Calculados finales
horas_ahorradas, ahorro_horas_hombre, valor_ahorro
roi_valor, roi_valor_total, roi_pct
cuadrante_roi: alto_impacto | proceso_pesado | eficiencia_menor | bajo_impacto
```

### ProjectComment
```
id, project_id, author_id, author_role, author_name
message
tipo: comentario | cambio_estado | feedback | aprobacion
created_at
```

---

## 5. Cuadrantes de la Matriz

### Matriz Impacto/Esfuerzo (0-100 cada eje)
| Cuadrante | Condición |
|-----------|-----------|
| **esencial** | impacto >= 50, esfuerzo < 50 |
| **estrategico** | impacto >= 50, esfuerzo >= 50 |
| **indiferente** | impacto < 50, esfuerzo < 50 |
| **lujo** | impacto < 50, esfuerzo >= 50 |

### Cuadrante ROI (umbral: 4h ahorradas, 50.000 COP)
| Cuadrante | Condición |
|-----------|-----------|
| **alto_impacto** | horas >= 4 Y valor >= 50k |
| **proceso_pesado** | horas >= 4 Y valor < 50k |
| **eficiencia_menor** | horas < 4 Y valor >= 50k |
| **bajo_impacto** | horas < 4 Y valor < 50k |

### Cálculo de scores (matrix_service.py)
```
score = promedio_ponderado(respuestas) / 5 * 100
# Respuestas: 1-5 por pregunta, peso definido en MatrixQuestion.weight
```

### Cálculo ROI (roi_service.py)
```
valor_hora_hombre = salario_base / 240
horas_ahorradas = (horas_actual - horas_nuevo) * num_personas
ahorro_horas_hombre = horas_ahorradas * valor_hora_hombre
roi_pct = (ahorro_horas_hombre / salario_base) * 100
```

---

## 6. Todos los Endpoints de la API

### Auth — `/auth`
| Método | Ruta | Rol mínimo | Descripción |
|--------|------|------------|-------------|
| POST | `/auth/register` | coordinador | Crear usuario |
| POST | `/auth/token` | público | Login (OAuth2) |
| GET | `/auth/me` | usuario | Usuario actual |
| GET | `/auth/users` | coordinador | Listar usuarios activos |
| PUT | `/auth/users/{id}/role` | coordinador | Cambiar rol |
| PUT | `/auth/users/{id}` | coordinador | Actualizar datos |
| DELETE | `/auth/users/{id}` | coordinador | Desactivar usuario |
| GET | `/auth/users/archived` | coordinador | Usuarios archivados (6 meses) |
| POST | `/auth/users/{id}/reactivar` | coordinador | Reactivar usuario |
| DELETE | `/auth/users/{id}/permanent` | coordinador | Eliminar permanente |

### Projects — `/projects`
| Método | Ruta | Rol mínimo | Descripción |
|--------|------|------------|-------------|
| GET | `/projects` | usuario | Listar (usuario ve solo los suyos) |
| POST | `/projects` | usuario | Crear proyecto |
| GET | `/projects/{id}` | usuario | Ver detalle |
| DELETE | `/projects/{id}` | usuario | Eliminar |
| POST | `/projects/{id}/escalar` | admin | Escalar a superadmin |
| POST | `/projects/{id}/superaprobar` | superadmin | Aprobar + asignar preguntas |
| GET | `/projects/{id}/questions` | admin | Ver preguntas asignadas |
| POST | `/projects/{id}/iniciar-evaluacion` | admin | Iniciar evaluación |
| POST | `/projects/{id}/marcar-evaluado` | admin | Marcar evaluado |
| POST | `/projects/{id}/proveer-salario` | superadmin | Ingresar datos salariales |
| PATCH | `/projects/{id}/corregir-salario` | superadmin | Corregir datos salariales |
| POST | `/projects/{id}/completar-roi` | admin | Completar cálculo ROI |
| POST | `/projects/{id}/rechazar` | admin | Rechazar proyecto |

### Matrix — `/matrix`
| Método | Ruta | Rol mínimo | Descripción |
|--------|------|------------|-------------|
| GET | `/matrix/categories` | usuario | Categorías activas |
| POST | `/matrix/categories` | superadmin | Crear categoría vacía |
| POST | `/matrix/categories/with-questions` | superadmin | Crear categoría con preguntas |
| GET | `/matrix/questions` | usuario | Listar preguntas (filter: category) |
| POST | `/matrix/evaluate/{id}` | admin | Enviar evaluación |
| GET | `/matrix/plot` | usuario | Datos scatter plot |
| GET | `/matrix/history/{id}` | admin | Historial evaluaciones |

### ROI — `/roi`
| Método | Ruta | Rol mínimo | Descripción |
|--------|------|------------|-------------|
| GET | `/roi/sedes` | usuario | Lista de sedes |
| GET | `/roi/plot/all` | coordinador | Scatter plot ROI |
| POST | `/roi/{id}/parte1` | superadmin | Ingresar salario (privado) |
| PATCH | `/roi/{id}/parte2` | admin | Ingresar datos operativos |
| GET | `/roi/history/{id}` | admin | Historial ROI |
| GET | `/roi/{id}` | admin | ROI actual |

### Dashboard — `/dashboard`
| Método | Ruta | Rol mínimo | Descripción |
|--------|------|------------|-------------|
| GET | `/dashboard/stats` | usuario | Conteos (role-aware) |
| GET | `/dashboard/quadrant-summary` | usuario | Distribución por cuadrante |

### Settings — `/settings` (solo admin+)
| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/settings/categories` | Listar categorías con conteo de preguntas |
| POST | `/settings/categories` | Crear categoría |
| PUT | `/settings/categories/{id}` | Actualizar categoría |
| DELETE | `/settings/categories/{id}` | Eliminar categoría |
| GET | `/settings/questions` | Listar todas las preguntas |
| GET | `/settings/questions/category/{id}` | Preguntas por categoría |
| POST | `/settings/questions` | Crear pregunta |
| PUT | `/settings/questions/{id}` | Actualizar pregunta |
| DELETE | `/settings/questions/{id}` | Eliminar pregunta |

### Otros
| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | `/webhook/lists` | Recibe proyectos de Power Automate (header: X-Webhook-Secret) |
| GET | `/health` | Health check (retorna `{"status": "ok", "version": "0.2.0"}`) |
| WS | `/ws` | WebSocket tiempo real |

---

## 7. Eventos WebSocket

Todos emitidos con `ws_manager.broadcast(event_type, payload)`:

```
project.created         → nuevo proyecto manual
project.webhook         → nuevo proyecto desde Power Automate
project.escalado        → admin escaló
project.superaprobado   → superadmin aprobó
project.en_evaluacion   → admin inició evaluación
project.evaluado        → evaluación completada
project.pendiente_salario → superadmin ingresó salario
project.aprobado_final  → ROI completado, proyecto aprobado
project.rechazado       → proyecto rechazado en cualquier etapa
evaluation_created      → nueva evaluación de matriz
comment.created         → nuevo comentario
```

---

## 8. Rutas del Frontend

```
/login              → LoginPage (público)
/dashboard          → DashboardPage (todos los roles)
/projects           → ProjectsPage (coordinador+, usuario redirige a /mis-proyectos)
/mis-proyectos      → UserProjectsPage (solo usuario)
/projects/:id       → ProjectDetailPage (todos los roles)
/matrix             → MatrixPage (coordinador+)
/settings           → SettingsPage (admin+ únicamente)
```

**Stores Zustand:**
- `authStore` → user, token, isAuthenticated (persiste en localStorage)
- `projectStore` → projects, plotPoints, wsConnected
- `toastStore` → notificaciones tipo sonner
- `commentEventStore` → último evento de comentario por WebSocket
- `roiEventStore` → contador para forzar re-fetch de ROI

---

## 9. Configuración Docker

### Arquitectura de contenedores
```
Browser → Nginx (puerto 80)
              ├── /          → archivos estáticos (React build)
              ├── /api/*     → proxy a backend:8000/* (quita /api)
              └── /ws        → proxy WebSocket a backend:8000/ws

Backend (interno, solo expuesto a Nginx)
              └── :8000 FastAPI + Uvicorn
                      └── SQLite en volumen Docker: sqlite_data:/app/data
```

### Archivos Docker creados
```
Matriz/
├── docker-compose.yml
├── .env.example                    ← copiar como .env y llenar secretos
├── backend/
│   ├── Dockerfile                  ← python:3.11-slim + uvicorn 0.0.0.0:8000
│   └── .dockerignore               ← excluye venv/, __pycache__, .env, data/
└── frontend/
    ├── Dockerfile                  ← multi-stage: node:20-alpine build + nginx:alpine serve
    ├── nginx.conf                  ← proxy /api y /ws + SPA fallback
    └── .dockerignore               ← excluye node_modules/, dist/
```

### Variables de entorno para Docker (`.env` en raíz)
```bash
SECRET_KEY=<genera con: openssl rand -hex 32>
ACCESS_TOKEN_EXPIRE_MINUTES=480
WEBHOOK_SECRET=<secreto compartido con Power Automate>
SUPERADMIN_EMAIL=admin@matrix.com
SUPERADMIN_PASSWORD=<contraseña segura>
```

### Comandos Docker
```bash
# Primera vez o rebuild
docker compose up --build -d

# Solo levantar
docker compose up -d

# Ver logs
docker compose logs -f

# Ver logs de un servicio
docker compose logs -f backend

# Parar
docker compose down

# Parar y borrar volúmenes (⚠️ borra la BD)
docker compose down -v

# Entrar al contenedor backend
docker compose exec backend bash
```

### WebSocket en producción con dominio propio
Si se despliega con dominio real (ej. `https://miapp.com`), cambiar en `docker-compose.yml`:
```yaml
frontend:
  build:
    args:
      VITE_WS_URL: wss://miapp.com/ws   # ← wss:// para HTTPS
```

---

## 10. Cómo Correr en Desarrollo Local

### Backend
```bash
cd backend
python -m venv venv
# Windows:
venv\Scripts\activate
pip install -r requirements.txt
# Copiar .env.example como .env y configurar
python run.py
# → http://localhost:8000
# → Docs: http://localhost:8000/docs
```

### Frontend
```bash
cd frontend
npm install
npm run dev
# → http://localhost:5199
# → Proxy /api → http://127.0.0.1:8000
```

**Nota:** `run.py` usa `host="127.0.0.1"` en desarrollo. En Docker el CMD del Dockerfile usa `uvicorn ... --host 0.0.0.0` directamente.

---

## 11. Archivos Clave y sus Responsabilidades

| Archivo | Responsabilidad |
|---------|----------------|
| `backend/app/main.py` | FastAPI app, CORS, lifespan (migrations + seeds), incluye routers |
| `backend/app/database.py` | Conexión SQLite, migraciones manuales, `create_db_and_tables()` |
| `backend/app/config.py` | Settings desde .env via pydantic-settings |
| `backend/app/core/dependencies.py` | `get_current_user()`, guards de rol, `get_db()` |
| `backend/app/core/ws_manager.py` | WebSocketManager singleton, `broadcast()` |
| `backend/app/services/project_service.py` | State machine, `VALID_TRANSITIONS`, toda la lógica de flujo |
| `backend/app/services/matrix_service.py` | Cálculo de scores ponderados, determinación de cuadrante |
| `backend/app/services/roi_service.py` | Cálculos ROI, `_calcular_valor_hora()`, cuadrante ROI |
| `frontend/src/App.tsx` | Rutas, guards de autenticación y rol |
| `frontend/src/store/authStore.ts` | Auth con persistencia localStorage |

---

## 12. Integraciones Externas

### Microsoft Power Automate
- Flujo de Power Automate envía POST a `/webhook/lists`
- Header requerido: `X-Webhook-Secret: <WEBHOOK_SECRET>`
- Crea proyectos con `source: "list"` y guarda `ms_list_id`
- Permite rastrear el origen Microsoft Lists del proyecto

---

## 13. Notas de Arquitectura Importantes

1. **SQLite en producción**: Proyecto usa SQLite (no PostgreSQL). El `DATABASE_URL` soporta ambos pero actualmente solo SQLite está en uso. Las migraciones son manuales (`ALTER TABLE` en `database.py`) por limitaciones de SQLite con Alembic.

2. **CORS innecesario en Docker**: Como nginx hace proxy, el browser ve todo desde el mismo origen (`localhost:80`). El backend configura CORS de todas formas para development local.

3. **VITE_WS_URL es baked en build time**: No es una variable de runtime. Cambia solo recompilando el frontend. En Docker se pasa como `build.args` en docker-compose.yml.

4. **Salario es privado**: `ROIEvaluation.salario_base` y campos derivados (valor_quincena, etc.) solo son visibles para superadmin. El admin solo puede ver y editar los campos operativos.

5. **Comentarios filtrados por rol**: Usuarios solo ven sus propios comentarios + los de tipo `feedback` y `cambio_estado`. Admins+ ven todos.

6. **Seeds en startup**: El seeder (`backend/app/seeds/`) crea el superadmin por defecto y las preguntas de matriz si no existen, cada vez que inicia el servidor.
