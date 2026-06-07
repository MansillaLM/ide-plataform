# Curso Explicativo: Fundamentos y Funcionamiento de Nuestra IDE Local
> **Destinatario:** Gerencia de Proyecto (Perfil No Técnico)  
> **Objetivo:** Comprender qué hemos construido, qué tecnologías intervienen (explicadas de forma sencilla) y las ventajas estratégicas de esta arquitectura.

---

## 🗺️ Introducción: ¿Qué es una IDE y por qué la necesitamos?

Una **IDE (Infraestructura de Datos Espaciales)** es, en términos sencillos, el "Google Maps" o "Catastro Digital" privado de nuestra organización. Es un sistema centralizado que permite unificar mapas (como fotos tomadas por drones) con datos tabulares (información de parcelas, límites, dueños, áreas) para que cualquier persona pueda consultarlos e interactuar con ellos desde una página web sin instalar programas complejos.

Tomando como referencia el modelo exitoso de **Mapas Córdoba**, hemos desarrollado un prototipo local que funciona exactamente bajo los mismos principios profesionales de velocidad e interactividad.

---

## 📚 Módulo 1: La "Caja de Herramientas" (Explicada con Analogías)

Para lograr que el mapa funcione rápido y no requiera instalaciones complejas en la computadora de cada usuario, agrupamos diferentes tecnologías. Aquí te explicamos qué hace cada una usando analogías cotidianas:

### 1. Docker y Docker Compose (El Barco de Carga y los Contenedores)
* **El problema técnico:** Tradicionalmente, instalar una base de datos, servidores de mapas y configuraciones web en computadoras distintas causaba el clásico problema de: *"En mi máquina funciona, pero en la tuya no"* debido a versiones de Windows o archivos faltantes.
* **La solución (Docker):** Imagina los contenedores de los puertos marítimos. Docker mete cada programa (la base de datos, el servidor de mapas, la web) dentro de un "contenedor de software" cerrado y listo para usar.
* **Docker Compose (El Manifiesto de Carga):** Es el plano que le dice a la computadora: *"Descarga estos 4 contenedores y conéctalos entre sí"*. Gracias a esto, encender todo el sistema requiere **un solo comando**, y funcionará exactamente igual en tu computadora, en la mía o en un servidor en la nube.

### 2. PostgreSQL + PostGIS (La Planilla Excel Inteligente)
* **¿Qué es?:** Es nuestro cerebro de almacenamiento. PostgreSQL es una base de datos tradicional (como un Excel gigante), pero al añadirle **PostGIS**, esa planilla aprende geometría.
* **Analogía:** Un Excel común puede guardar la dirección "Calle Falsa 123". Una base de datos con PostGIS puede calcular la superficie exacta de una parcela con forma irregular, saber qué parcelas limitan con otras o medir distancias en metros de forma automática.

### 3. Servidores de Mapas: GeoServer y pg_tileserv (Los Cocineros)
El navegador web (Chrome, Edge) no sabe cómo interpretar archivos de mapas crudos de varios gigabytes. Necesita que alguien se los "cocine" en porciones pequeñas.
* **GeoServer (El Cocinero de Fotos):** Se encarga de tomar las fotos pesadas de los drones (rásters) y, a medida que te mueves en el mapa, recorta rápidamente la sección exacta que estás viendo y te la envía como una imagen liviana.
* **pg_tileserv (El Distribuidor de Vectores):** Se encarga de las líneas y polígonos (ej. parcelas catastrales). En lugar de enviar imágenes pesadas, extrae las líneas de la base de datos y las envía como coordenadas binarias ultralivianas. Esto permite que, al hacer clic sobre una parcela en el visor web, la respuesta con sus datos sea instantánea.

### 4. Visor Web (El Plato Servido)
* **¿Qué es?:** La página web interactiva construida con `MapLibre GL JS`.
* **Analogía:** Es la mesa del restaurante. Es el diseño en color oscuro donde el usuario final puede encender o apagar capas, deslizar la opacidad de la foto del dron, ver las coordenadas del mouse en tiempo real y hacer clic en los polígonos para desplegar la información en un panel lateral.

---

## 🛠️ Módulo 2: El Proceso Paso a Paso (¿Cómo lo construimos?)

El flujo de desarrollo constó de 4 fases lógicas:

```
[ Fase 1: Optimización de Foto ] ──> [ Fase 2: Encendido de Contenedores ] ──> [ Fase 3: Carga de Datos ] ──> [ Fase 4: Integración Web ]
```

### Clase 2.1: Preparar la foto del dron (Fase 1)
Una foto aérea de alta resolución (como la que subiste, de 150MB) es demasiado pesada para cargarse de golpe en internet. 
* **Lo que hicimos:** Convertimos la imagen al formato estándar **GeoTIFF** y le creamos **"pirámides de zoom"**.
* **¿Qué significa?:** El archivo ahora guarda copias en miniatura de sí mismo. Si estás viendo la ciudad completa, el mapa usa la miniatura (liviana); si haces mucho zoom a una manzana, el mapa lee solo la porción de máxima definición de esa manzana. Esto optimiza el ancho de banda y la velocidad.

### Clase 2.2: Levantar la infraestructura (Fase 2)
* **Lo que hicimos:** Ejecutamos Docker. En segundos, se descargaron y configuraron de forma aislada e intercomunicada:
  1. El motor de Base de Datos.
  2. El servidor de mapas GeoServer.
  3. El servidor de parcelas rápidas (`pg_tileserv`).
  4. El servidor web tradicional (`Nginx`) que muestra la página.

### Clase 2.3: Importar el catastro (Fase 3)
* **Lo que hicimos:** Tomamos tu archivo vector (`shp_wgs`, que representa las parcelas) y lo inyectamos directamente dentro de la base de datos PostGIS. A partir de ese momento, cada parcela dejó de ser un simple dibujo y se convirtió en un registro inteligente con área, identificador y coordenadas reales en el planeta.

### Clase 2.4: La conexión inteligente (Fase 4)
* **Lo que hicimos:** Creamos el código del visor web (`app.js`). Diseñamos una interfaz interactiva donde el usuario puede:
  * Regular la transparencia (opacidad) del vuelo del dron para ver cómo coincide con el mapa base de la ciudad.
  * Seleccionar cualquier lote para que el panel lateral le muestre de forma automática su ID y superficie calculada desde la base de datos.
  * **Optimización de Caché:** Configuramos el sistema para que GeoServer guarde en memoria cada imagen solicitada. Así, la navegación se vuelve fluida y veloz a los pocos segundos de uso.

---

## 📈 Módulo 3: Ventajas Estratégicas para la Toma de Decisiones

Como Gerente de Proyecto, esta arquitectura te ofrece importantes beneficios de negocio frente a soluciones tradicionales (como ArcGIS / ESRI):

1. **Costo Cero de Licencias (Open Source):** Toda la pila tecnológica utilizada (PostgreSQL, PostGIS, GeoServer, Docker, MapLibre) es de código abierto. No existen costos mensuales ni anuales por licencias de software, lo que reduce drásticamente el presupuesto del proyecto.
2. **Escalabilidad Infinita:** Si el día de mañana debemos cargar toda la provincia de Córdoba en lugar de una manzana, la base de datos PostGIS y las optimizaciones de GeoServer están listas para soportarlo sin degradar la velocidad.
3. **Fácil Mantenimiento y Portabilidad (Cloud-Ready):** Si queremos pasar este prototipo de tu computadora a un servidor público en internet (como Amazon Web Services, Azure o Google Cloud), el proceso tomará **minutos**. Solo necesitamos copiar la carpeta, instalar Docker en el servidor y encenderlo. Todo funcionará exactamente igual.
4. **Independencia Tecnológica:** La organización tiene el control absoluto del código, el diseño del visor y los datos, sin depender de contratos o restricciones de proveedores externos.
