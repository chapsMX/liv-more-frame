# LivMore Mini App Project Scratchpad

## Background and Motivation
LivMore es una mini app para Farcaster que se integra con dispositivos wearables para gamificar el bienestar mediante la integración de dispositivos wearables, attestations en blockchain y retos sociales. El proyecto requiere un manejo adecuado de acceso de usuarios y aceptación de términos legales antes de permitir el uso completo de la aplicación.

Se requiere implementar un sistema que fuerce a los usuarios a actualizar sus metas diarias cuando estas estén por debajo de los valores mínimos requeridos (Calorías: 2000, Pasos: 7000, Sueño: 7 horas).

## Key Challenges and Analysis
1. **Gestión de Estado Global**
   - Implementación de React Context
   - Manejo de estados de usuario
   - Persistencia en localStorage

2. **Flujo de Usuario Actualizado**
   - Validación de whitelist y estado de usuario
   - Modal de TOS/PP cuando sea necesario
   - Redirección a DashboardInicial
   - Sign in automático (fase final)

3. **Estados de Usuario**
   - is_whitelisted: Control de whitelist
   - accepted_tos: Aceptación de términos
   - accepted_privacy_policy: Aceptación de privacidad
   - can_use: Permiso de uso de app

4. **Validación de Metas Mínimas**
   - Validación simple de valores mínimos (Calorías: 2000, Pasos: 7000, Sueño: 7)
   - Modal forzado cuando valores sean inválidos
   - No permitir cerrar modal hasta tener valores válidos

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

## Current Status / Progress Tracking
Estado actual: Plan simplificado para validación de metas mínimas, listo para implementación.

## Executor's Feedback or Assistance Requests
Pendiente de aprobación para iniciar implementación del Context

## Lessons
- Importancia de mantener consistencia en estados de usuario
- Necesidad de validación en múltiples niveles
- El modal de TOS/PP es un bloqueador crítico para el uso de la app
- Implementación modular permite mejor manejo de cambios
- Priorización de funcionalidades core antes de autenticación
- Los valores mínimos son críticos para el funcionamiento correcto de la aplicación
- La UX debe ser clara y guiar al usuario en el proceso de actualización
- Mantener las soluciones lo más simples posibles 