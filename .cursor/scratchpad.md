# LivMore Mini App Project Scratchpad

## Background and Motivation
LivMore es una mini app para Farcaster que se integra con dispositivos wearables para gamificar el bienestar mediante la integración de dispositivos wearables, attestations en blockchain y retos sociales. El proyecto requiere un manejo adecuado de acceso de usuarios y aceptación de términos legales antes de permitir el uso completo de la aplicación.

Se requiere implementar un sistema que fuerce a los usuarios a actualizar sus metas diarias cuando estas estén por debajo de los valores mínimos requeridos (Calorías: 2000, Pasos: 7000, Sueño: 7 horas).

Ahora se requiere integrar el servicio de Rook para permitir que los usuarios conecten sus dispositivos wearables y obtengan sus datos de salud. Se utilizará el modo sandbox de Rook Connections para la implementación inicial.

The DashboardInicial component is experiencing an infinite loop in its verification process. This is causing continuous API calls and potential performance issues.

Necesitamos obtener métricas específicas de salud de los usuarios a través de la API de Rook:
- Pasos diarios
- Calorías
- Horas de sueño

## Key Challenges and Analysis
Analizando la documentación de Rook, encontramos que estas métricas se pueden obtener a través de diferentes endpoints:

1. Physical Health Summary (`/v2/processed_data/physical_health/summary`):
   - Contiene pasos diarios y calorías en un solo endpoint
   - Retorna un resumen diario completo de actividad física
   - Más eficiente que consultar eventos individuales
   - Campos relevantes:
     * `physical_summary.distance.steps_int`: pasos diarios
     * `physical_summary.calories.calories_expenditure_kcal_float`: calorías gastadas

2. Sleep Health Summary (`/v2/processed_data/sleep_health/summary`):
   - Contiene las horas de sueño
   - Proporciona un resumen diario completo del sueño
   - Campo relevante:
     * `sleep_summary.duration.sleep_duration_seconds_int`: duración total del sueño en segundos

Ventajas de usar los endpoints de Summary:
- Menos llamadas a la API (2 en lugar de 3)
- Datos ya procesados y agregados por día
- Mejor rendimiento y menos complejidad en el código
- Consistencia en el formato de los datos

Recomendación:
1. Crear dos endpoints en nuestro backend:
   - `/api/users/physical-summary`: obtiene pasos y calorías del endpoint de physical health
   - `/api/users/sleep-summary`: obtiene horas de sueño del endpoint de sleep health

2. No es necesario crear un endpoint unificado por ahora ya que:
   - Los datos vienen de endpoints diferentes en Rook
   - Mantener la separación nos da más flexibilidad
   - Podemos unificar en el frontend según necesitemos
   - Reduce la complejidad del backend

Parámetros necesarios para ambos endpoints:
- `user_id`: identificador del usuario
- `date`: fecha en formato YYYY-MM-DD

Formato de respuesta sugerido:
```json
// GET /api/users/physical-summary
{
  "steps": 10000,
  "calories": 2500
}

// GET /api/users/sleep-summary
{
  "sleep_duration_hours": 8.5
}
```

## Especificaciones del Modal TOS/PP
- **Diseño:**
  - Logo LivMore
  - Mensaje de bienvenida
  - Texto explicativo sobre TOS y PP
  - Checkbox único para aceptación
  - Links a documentos legales
- **Contenido:**
  ```text
  Welcome to Liv More

  To ensure a safe and transparent experience for all users, Liv More requires you to accept our Terms of Service and Privacy Policy. These documents explain how we handle your data, how the app works, and your rights as a user.

  By accepting them, you help us keep Liv More secure, respectful, and aligned with legal standards.

  [ ] I agree to the Terms of Service and Privacy Policy. I understand this is a beta.
  ```
- **Links:**
  - Terms of Service: https://livmore.life/terms
  - Privacy Policy: https://livmore.life/privacy

## High-level Task Breakdown (Orden Actualizado)
1. **Implementación de Context**
   - [ ] Crear UserContext
   - [ ] Implementar provider
   - [ ] Definir tipos y estados
   - [ ] Configurar persistencia con localStorage

2. **Implementación de Modal TOS/PP**
   - [ ] Crear componente dentro de LivMore.tsx
   - [ ] Implementar UI según especificaciones
   - [ ] Integrar con Context
   - [ ] Manejar actualización de estados

3. **Lógica de Validación y Redirección**
   - [ ] Implementar validaciones de estado
   - [ ] Configurar redirección a DashboardInicial
   - [ ] Agregar estados de loading
   - [ ] Manejar errores y logs

4. **Implementación de Sign In (Fase Final)**
   - [ ] Integrar sign in automático
   - [ ] Manejar estados de autenticación
   - [ ] Testing del flujo completo

5. **Implementación de Validación de Metas Mínimas**
   - [ ] Validación de Metas
     - Agregar constantes para valores mínimos
     - Modificar endpoint check-goals para incluir validación
     - Success Criteria: API retorna si los valores son válidos

   - [ ] Forzar Actualización
     - Modificar DGModal para no permitir cierre si valores < mínimos
     - Mostrar DGModal automáticamente si check-goals indica valores inválidos
     - Success Criteria: Usuario no puede continuar hasta actualizar valores

6. **Integración con Rook**
   - Implementación de Rook Connections en modo sandbox
   - Manejo de autenticación y autorización de dispositivos
   - Almacenamiento de conexiones de usuario
   - Procesamiento y entrega de datos de salud
   - Manejo de diferentes tipos de dispositivos (API-Based y Mobile-Based)

## High-level Task Breakdown (Rook Integration)

1. **Setup Inicial de Rook Connections**
   - [ ] Crear componente RookDeviceConnection
     - Crear nuevo componente separado (no modal)
     - Implementar iframe para Rook Connections
     - Manejar eventos de conexión exitosa
     - Success Criteria: El iframe se carga correctamente y muestra las opciones de dispositivos

   - [ ] Implementar manejo de user_fid y redirección
     - Obtener user_fid de whitelist_users
     - Generar URL de Rook Connections con client_uuid y user_fid
     - Implementar lógica de redirección basada en connected_provider
     - Success Criteria: La URL se genera correctamente y la redirección funciona según el estado

2. **Almacenamiento de Conexiones**
   - [ ] Utilizar tablas existentes
     - Actualizar whitelist_users.connected_provider con el provider retornado por Rook
     - Utilizar rook_connection para datos detallados de la conexión
     - Success Criteria: Los datos de conexión se guardan correctamente en ambas tablas

   - [ ] Implementar lógica de guardado
     - Guardar conexión cuando el usuario conecta un dispositivo
     - Actualizar estado si ya existe
     - Success Criteria: Las conexiones se guardan correctamente en la base de datos

3. **Integración con API de Rook**
   - [ ] Configurar cliente de API
     - Setup de URL base para sandbox (api.rook-connect.review)
     - Implementar manejo de autenticación con credenciales del .env
     - Success Criteria: El cliente puede hacer llamadas exitosas a la API

   - [ ] Implementar endpoints necesarios
     - Endpoint para obtener datos de usuario
     - Endpoint para verificar estado de conexión
     - Success Criteria: Los endpoints responden correctamente con la data esperada

4. **Flujo de Usuario**
   - [ ] Implementar lógica de redirección
     - Verificar connected_provider después de definir objetivos
     - Redirigir a RookDeviceConnection si no hay provider
     - Redirigir a DashboardInicial si ya hay provider
     - Success Criteria: El flujo de redirección funciona correctamente

   - [ ] Manejar eventos post-conexión
     - Actualizar connected_provider con el valor retornado por Rook
     - Redirigir a DashboardInicial después de conexión exitosa
     - Success Criteria: El flujo post-conexión es fluido y sin errores

5. **Testing y Validación**
   - [ ] Pruebas de integración
     - Flujo completo de conexión
     - Manejo de casos edge
     - Success Criteria: Todos los casos de prueba pasan

   - [ ] Documentación
     - Guía de implementación
     - Troubleshooting común
     - Success Criteria: La documentación es clara y completa

## High-level Task Breakdown
1. Separate Verification Logic
   - [ ] Split verification into initial and continuous monitoring phases
   - [ ] Move initial permission checks to a separate useEffect
   - [ ] Optimize state updates to prevent unnecessary rerenders
   Success Criteria: Component only performs initial checks once and continuous monitoring at appropriate intervals

2. Implement State Update Optimization
   - [ ] Add comparison before updating userState
   - [ ] Add comparison before updating hasValidGoals
   - [ ] Remove unnecessary dependencies from useEffect
   Success Criteria: State updates only occur when values actually change

## Project Status Board
- [x] Análisis completado
- [x] Plan de implementación actualizado
- [ ] Context implementado
- [ ] Modal TOS/PP implementado
- [ ] Validaciones completadas
- [ ] Sign in integrado
- [ ] Validación de metas mínimas implementada
- [ ] Modal de actualización forzada completado
- [ ] Integración con UI principal
- [ ] Validación en backend
- [ ] Testing de flujo completo
- [ ] Setup inicial de Rook Connections
- [ ] Almacenamiento de conexiones implementado
- [ ] Integración con API de Rook completada
- [ ] UI/UX para conexión de dispositivos
- [ ] Testing y validación finalizados

## Current Status / Progress Tracking
Estado actual: Plan de integración con Rook refinado con los detalles de implementación específicos, listo para comenzar con el setup inicial de RookDeviceConnection.

## Executor's Feedback or Assistance Requests
Pendiente de aprobación para iniciar implementación del componente RookDeviceConnection.

## Lessons
- Importancia de mantener consistencia en estados de usuario
- Necesidad de validación en múltiples niveles
- El modal de TOS/PP es un bloqueador crítico para el uso de la app
- Implementación modular permite mejor manejo de cambios
- Priorización de funcionalidades core antes de autenticación
- Los valores mínimos son críticos para el funcionamiento correcto de la aplicación
- La UX debe ser clara y guiar al usuario en el proceso de actualización
- Mantener las soluciones lo más simples posibles 
- La integración con servicios externos requiere un manejo cuidadoso de errores y estados
- Es importante mantener una buena experiencia de usuario durante el proceso de conexión
- El modo sandbox es crucial para testing antes de producción
- La integración con Rook debe mantener un flujo de usuario simple y directo
- Utilizar las estructuras de base de datos existentes en lugar de crear nuevas

## High-level Task Breakdown
1. Separate Verification Logic
   - [ ] Split verification into initial and continuous monitoring phases
   - [ ] Move initial permission checks to a separate useEffect
   - [ ] Optimize state updates to prevent unnecessary rerenders
   Success Criteria: Component only performs initial checks once and continuous monitoring at appropriate intervals

2. Implement State Update Optimization
   - [ ] Add comparison before updating userState
   - [ ] Add comparison before updating hasValidGoals
   - [ ] Remove unnecessary dependencies from useEffect
   Success Criteria: State updates only occur when values actually change

## Project Status Board
- [ ] Task 1: Implement verification logic separation
- [ ] Task 2: Implement state update optimization

## Current Status / Progress Tracking
- Issue identified: Infinite loop in DashboardInicial component
- Root cause: Circular dependency in useEffect with state updates

## Executor's Feedback or Assistance Requests
None yet - awaiting implementation approval

## Lessons
- Always check for circular dependencies when using useEffect with state updates
- Separate initialization logic from continuous monitoring
- Compare values before updating state to prevent unnecessary rerenders 

## High-level Task Breakdown
1. Implementar endpoint para obtener Physical Health Summary
   - [ ] Crear `/api/users/physical-summary`
   - [ ] Integrar autenticación con Rook
   - [ ] Extraer métricas relevantes (pasos y calorías)
   - Success Criteria: Endpoint retorna datos formateados de pasos y calorías diarias

2. Implementar endpoint para obtener Sleep Health Summary
   - [ ] Crear `/api/users/sleep-summary`
   - [ ] Integrar autenticación con Rook
   - [ ] Extraer métricas de sueño
   - Success Criteria: Endpoint retorna datos formateados de horas de sueño

3. Implementar endpoint unificado (opcional)
   - [ ] Crear `/api/users/health-summary`
   - [ ] Combinar datos de ambos endpoints de Rook
   - [ ] Retornar todas las métricas en un solo formato
   - Success Criteria: Endpoint retorna todas las métricas necesarias en una sola llamada

## Project Status Board
- [ ] Task 1: Implementar Physical Health Summary endpoint
- [ ] Task 2: Implementar Sleep Health Summary endpoint
- [ ] Task 3: (Opcional) Implementar endpoint unificado

## Current Status / Progress Tracking
Planificación inicial de endpoints para métricas de salud.

## Executor's Feedback or Assistance Requests
Pendiente de aprobación para comenzar la implementación.

## Lessons
- Usar endpoints de resumen es más eficiente que endpoints individuales
- La consolidación de datos en el backend reduce la complejidad en el frontend
- Mantener la consistencia en el formato de respuesta facilita el consumo de los datos 

## Comandos útiles para debugging de Rook API

### Revisión manual de conexión de dispositivos:
```bash
curl -X GET "https://api.rook-connect.review/api/v1/user_id/20701/data_sources/authorized" \
-H "Authorization: Basic ODg2MTZkMjAtZGE1MS00ZDMxLWI5YTgtNDM2ZjAyZTNjYTk4Om96RTU5c0w0Z1ZIdG1tRmVIZ1djdGJjakxaU2RPS3pnbXI4RQ=="
```

### Desconexión manual de dispositivos:
```bash
curl -X POST "https://api.rook-connect.review/api/v1/user_id/20701/data_sources/revoke_auth" \
-H "Authorization: Basic ODg2MTZkMjAtZGE1MS00ZDMxLWI5YTgtNDM2ZjAyZTNjYTk4Om96RTU5c0w0Z1ZIdG1tRmVIZ1djdGJjakxaU2RPS3pnbXI4RQ==" \
-H "Content-Type: application/json" \
-d '{"data_source": "Garmin"}'
```

### Consulta manual de data
```bash
curl -X GET "https://api.rook-connect.review/v2/processed_data/physical_health/summary?user_id=20701&start_date=2024-03-13&end_date=2024-03-19" \
-H "Authorization: Basic ODg2MTZkMjAtZGE1MS00ZDMxLWI5YTgtNDM2ZjAyZTNjYTk4Om96RTU5c0w0Z1ZIdG1tRmVIZ1djdGJjakxaU2RPS3pnbXI4RQ==" \
-H "Content-Type: application/json"
```

Estos comandos son útiles para:
- Verificar el estado de conexión de dispositivos
- Desconectar manualmente dispositivos cuando sea necesario
- Debugging de problemas de conexión
- Testing de la integración con Rook 