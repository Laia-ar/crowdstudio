# User Stories — Crowd Studio

## Roles de usuario

| Rol | Descripción |
|-----|-------------|
| **Visitante** | Persona no registrada que navega el sitio. |
| **Usuario registrado** | Tiene cuenta pero aún no aportó a ningún proyecto. |
| **Miembro de comunidad** | Usuario que aportó a al menos un proyecto (rol aceptado, donación o recurso aportado). |
| **Productor / Admin** | Crea proyectos, define roles y recursos, gestiona postulaciones y valida trabajo. |

> **Regla de membresía**: ser miembro no es solo registrarse. Requiere un aporte validado: rol asignado, donación económica o recurso aceptado en **cualquier** proyecto.

---

## 1. Visitante

### US-01: Explorar proyectos públicos
> **Como** visitante  
> **Quiero** ver los proyectos activos  
> **Para** entender qué se está produciendo en la plataforma.

- **Criterios de aceptación**:
  - La home muestra una lista de proyectos activos.
  - Cada proyecto muestra: título, tipo, descripción corta, estado y roles disponibles.
  - Puedo entrar al detalle de un proyecto sin iniciar sesión.
  - En el detalle veo: descripción, objetivos, roles necesarios, equipos/insumos/locaciones solicitados y agenda de reuniones.
  - No puedo postularme, ofrecer recursos, votar ni donar sin iniciar sesión.

### US-02: Entender cómo funciona la plataforma
> **Como** visitante  
> **Quiero** leer una explicación clara del modelo  
> **Para** evaluar si quiero participar.

- **Criterios de aceptación**:
  - Existe una página "Cómo funciona" accesible desde el menú.
  - Explica los 4 pilares: proyectos abiertos, participación profesional o como mecenas, espacios de trabajo por área, distribución económica transparente.
  - Deja en claro que profesionales y mecenas tienen el mismo derecho de voto.

### US-03: Crear cuenta
> **Como** visitante  
> **Quiero** registrarme con email y contraseña  
> **Para** convertirme en usuario registrado.

- **Criterios de aceptación**:
  - El formulario de registro pide: nombre completo, email, contraseña (mínimo 6 caracteres).
  - No puedo registrarme con un email ya existente.
  - Tras registrarme puedo iniciar sesión inmediatamente.
  - El rate limiting protege el endpoint de registro (máx. 10 intentos/minuto desde la misma IP).

---

## 2. Usuario registrado

### US-04: Iniciar sesión
> **Como** usuario registrado  
> **Quiero** ingresar con mi email y contraseña  
> **Para** acceder a funcionalidades privadas.

- **Criterios de aceptación**:
  - El login devuelve un token JWT válido por 24 horas.
  - Si las credenciales son incorrectas, recibo un mensaje de error claro.
  - El rate limiting protege el endpoint de login (máx. 10 intentos/minuto desde la misma IP).

### US-05: Explorar proyectos como usuario logueado
> **Como** usuario registrado  
> **Quiero** ver todos los proyectos  
> **Para** evaluar en cuáles quiero participar.

- **Criterios de aceptación**:
  - Veo el listado completo de proyectos con su estado.
  - Se indica si ya soy miembro de la comunidad de ese proyecto.
  - En cada rol se indica si ya me postulé.

### US-06: Postularse a un rol
> **Como** usuario registrado  
> **Quiero** postularme a un rol disponible  
> **Para** aportar mi trabajo al proyecto.

- **Criterios de aceptación**:
  - Puedo enviar un mensaje al productor explicando por qué soy adecuado.
  - Si el rol **requiere experiencia comprobable**, el campo "Referencias / Links de trabajos previos" es obligatorio.
  - No puedo postularme dos veces al mismo rol.
  - No puedo postularme si el rol ya fue asignado.
  - Tras enviar la postulación recibo confirmación visual.

### US-07: Ofrecer un recurso
> **Como** usuario registrado  
> **Quiero** ofrecer un equipo, insumo o locación  
> **Para** aportar al proyecto sin ocupar un rol técnico.

- **Criterios de aceptación**:
  - En el detalle del proyecto veo la lista de recursos necesarios (equipos, locaciones, insumos).
  - Puedo clickear "Ofrecer" en cualquier recurso que no esté cubierto.
  - Envío un mensaje describiendo qué aporto y en qué condiciones.
  - No puedo ofrecerme dos veces al mismo recurso.
  - El recurso sigue disponible hasta que el productor acepte una oferta.

### US-08: Realizar una donación económica
> **Como** usuario registrado  
> **Quiero** aportar dinero a un proyecto  
> **Para** apoyar como mecenas y obtener derecho a voto.

- **Criterios de aceptación**:
  - Puedo ingresar un monto y registrar la donación (simulada en esta etapa).
  - Al donar, automáticamente me convierto en miembro de la comunidad.
  - Veo un mensaje de confirmación tras el aporte.

---

## 3. Miembro de comunidad

Un usuario se convierte en **miembro** cuando:
- Tiene al menos una postulación **aceptada** en cualquier proyecto; **o**
- Realizó al menos una **donación** en cualquier proyecto; **o**
- Tiene al menos un **recurso aceptado** (equipo/insumo/locación) en cualquier proyecto.

### US-09: Ver estado de membresía
> **Como** usuario  
> **Quiero** saber si ya soy miembro de la comunidad  
> **Para** entender qué derechos tengo.

- **Criterios de aceptación**:
  - Mi perfil (`/api/me`) indica `is_community_member: true/false`.
  - En el listado de proyectos se indica si soy miembro de cada proyecto específico.

### US-10: Registrar horas de trabajo
> **Como** miembro con rol asignado  
> **Quiero** registrar mis contribuciones (horas y descripción)  
> **Para** que quede auditado mi aporte.

- **Criterios de aceptación**:
  - Solo puedo registrar contribuciones en roles que me fueron asignados.
  - Cada contribución queda en estado **Pendiente** hasta que el productor la valide.
  - Puedo ver el historial de mis contribuciones validadas y pendientes.

### US-11: Votar en encuestas de un proyecto
> **Como** miembro de un proyecto  
> **Quiero** votar en las votaciones abiertas  
> **Para** participar en las decisiones colectivas.

- **Criterios de aceptación**:
  - En el detalle del proyecto veo la sección "Votaciones del Proyecto" con encuestas activas.
  - Puedo seleccionar una opción y enviar mi voto.
  - Si ya voté, veo un indicador "Ya votaste" y no puedo votar de nuevo.
  - Si no soy miembro de ese proyecto, el sistema me impide votar (error 403).
  - Las votaciones cerradas muestran sus resultados.

### US-12: Ver agenda del proyecto
> **Como** miembro (o usuario registrado)  
> **Quiero** ver las reuniones e instancias programadas  
> **Para** participar o seguir el proceso formativo.

- **Criterios de aceptación**:
  - En el detalle del proyecto se muestra la agenda ordenada: primero eventos futuros (de más cercano a más lejano), luego eventos pasados recientes.
  - Cada evento muestra: título, fecha/hora, descripción y área/rol relacionado si aplica.

---

## 4. Productor / Administrador

### US-13: Crear un proyecto
> **Como** admin  
> **Quiero** dar de alta un nuevo proyecto  
> **Para** convocar a la comunidad a trabajar en una obra.

- **Criterios de aceptación**:
  - Solo admins pueden crear proyectos.
  - Debo ingresar: título, tipo (película, documental, etc.), descripción, objetivos y presupuesto teórico opcional.
  - El proyecto se crea con estado **Abierto**.

### US-14: Definir roles necesarios
> **Como** productor  
> **Quiero** agregar roles a mi proyecto  
> **Para** convocar al equipo técnico y creativo.

- **Criterios de aceptación**:
  - Puedo crear roles con: título, descripción, tareas, entregables, honorario de referencia.
  - Puedo marcar un rol como **"Requiere experiencia comprobable"**.
  - Los roles quedan visibles públicamente para que cualquiera se postule.

### US-15: Definir necesidades de recursos
> **Como** productor  
> **Quiero** solicitar equipos, insumos o locaciones  
> **Para** completar los requerimientos de producción.

- **Criterios de aceptación**:
  - Puedo agregar necesidades de 3 categorías: Equipo técnico, Locación/Espacio, Insumo/Material.
  - Cada necesidad tiene título y descripción.
  - Aparecen en el detalle del proyecto para que la comunidad ofrezca aportes.

### US-16: Gestionar postulaciones a roles
> **Como** productor  
> **Quiero** ver quién se postuló y aceptar/rechazar  
> **Para** armar el equipo definitivo.

- **Criterios de aceptación**:
  - Veo un listado con: rol, nombre del postulante, email, mensaje y referencias de experiencia (si el rol las exige).
  - Puedo **Aceptar** o **Rechazar** cada postulación.
  - Al aceptar, el usuario automáticamente se convierte en miembro de la comunidad.
  - El rol pasa a estado "Asignado" y desaparece la opción de postularse.

### US-17: Gestionar ofertas de recursos
> **Como** productor  
> **Quiero** ver quién ofreció un recurso y aceptar/rechazar  
> **Para** cubrir las necesidades de producción.

- **Criterios de aceptación**:
  - En cada recurso solicitado veo un botón **"Ver ofertas"**.
  - El modal muestra: nombre del oferente, email, mensaje y estado.
  - Puedo **Aceptar** una oferta (el recurso pasa a "Cuberto" y el oferente se convierte en miembro) o **Rechazarla**.
  - Al aceptar una oferta, las demás ofertas pendientes de ese recurso se rechazan automáticamente.

### US-18: Validar contribuciones de trabajo
> **Como** productor  
> **Quiero** validar o rechazar las horas registradas  
> **Para** mantener la auditoría del proyecto.

- **Criterios de aceptación**:
  - Veo un listado de contribuciones pendientes con: miembro, rol, descripción y horas trabajadas.
  - Puedo **Validar** (ingresando un monto de compensación opcional) o **Rechazar**.
  - Las contribuciones validadas quedan registradas para la distribución económica futura.

### US-19: Agendar instancias del proyecto
> **Como** productor  
> **Quiero** crear eventos en la agenda  
> **Para** organizar reuniones abiertas a la comunidad.

- **Criterios de aceptación**:
  - Puedo agendar reuniones con: título, descripción, fecha/hora y área/rol relacionado opcional.
  - Los eventos aparecen en el detalle del proyecto para toda la comunidad.
  - Puedo eliminar eventos si es necesario.

### US-20: Crear votaciones/encuestas
> **Como** productor  
> **Quiero** lanzar encuestas dentro del proyecto  
> **Para** dirimir decisiones colectivamente.

- **Criterios de aceptación**:
  - Puedo crear una votación con título, descripción y múltiples opciones.
  - La votación se crea con estado **Abierta**.
  - Veo el estado de las votaciones creadas y quién ya votó.

### US-21: Comercializar proyecto y distribuir
> **Como** productor  
> **Quiero** marcar el proyecto como comercializado con ingresos reales  
> **Para** iniciar la compensación del equipo.

- **Criterios de aceptación**:
  - Puedo ingresar los ingresos totales generados.
  - El sistema calcula automáticamente: ingreso total, compensación acumulada, excedente.
  - Los miembros pueden ver el desglose de distribución económica.

---

## Flujos end-to-end sugeridos para demos

### Demo 1: El camino de un profesional
1. Visitante entra a la home y lee "Cómo funciona".
2. Se registra como usuario.
3. Explora proyectos y se postula a un rol (con experiencia requerida).
4. El admin acepta la postulación → se convierte en miembro.
5. Registra horas de trabajo.
6. El admin valida sus contribuciones.

### Demo 2: El camino de un mecenas
1. Usuario registrado explora un proyecto.
2. Realiza una donación económica.
3. Automáticamente se convierte en miembro.
4. Participa votando en una encuesta del proyecto.

### Demo 3: El camino de un aportante de recursos
1. Usuario registrado ve que un proyecto necesita una locación.
2. Ofrece su espacio mediante el botón "Ofrecer".
3. El productor acepta la oferta.
4. El recurso aparece como "Cuberto" y el usuario como miembro.

### Demo 4: Gestión completa por el productor
1. Admin crea un proyecto de cortometraje.
2. Agrega roles (algunos con experiencia requerida).
3. Agrega necesidades de recursos.
4. Agenda reuniones de preproducción.
5. Crea una votación para decidir temas del proyecto.
6. Gestiona postulaciones, ofertas de recursos, valida horas y finalmente comercializa.
