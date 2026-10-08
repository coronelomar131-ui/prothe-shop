# PROTHE SHOPS

Tienda de tenis (sneakers) hecha con React + Vite, con catálogo en base de datos
y pedidos por WhatsApp. El dueño administra la tienda desde el celular, sin tocar código.

## Cómo se ve

Bandas de tinta y papel: barra y portada en negro, catálogo en blanco para que
manden las fotos de los tenis, y naranja de caja de tenis como único acento.
Tipografía Big Shoulders Display + Barlow.

## Qué hace

- **Catálogo en la nube.** Los pares viven en Supabase, así que lo que subes
  desde `/admin` lo ven todos tus clientes al instante.
- **Filtro por marca**, generado solo desde el catálogo: si subes un par de una
  marca nueva, su botón aparece sin tocar nada.
- **Tallas por par.** El cliente escoge su talla MX antes de agregar al carrito,
  y la talla viaja en el pedido de WhatsApp.
- **Etiquetas NUEVO y AGOTADO.** Los agotados se atenúan y su botón cambia a
  "Restock".
- **Carrito** que junta varios pares (cada talla cuenta aparte) y manda el pedido
  completo con total por WhatsApp.
- **Fotos comprimidas** al subirlas (máx. 1200 px, JPEG) para que la tienda no
  pese; cada tarjeta pide su foto solo cuando aparece en pantalla.
- **El probador.** El cliente sube su foto, escoge un par y una IA se lo pone
  encima para que vea cómo le queda antes de comprar. Ver abajo.

## El probador

El botón de la **percha** en cada tarjeta (y el botón flotante) abren un panel
donde el cliente sube su foto, escoge un par y la IA de Google le devuelve la
misma foto con esos tenis puestos. Puede probarse varios y compararlos, y de
ahí mandarte la imagen por WhatsApp o echar el par al carrito.

Solo aparece en los pares **que tienen foto**: sin foto del par no hay nada que
ponerle encima a la persona.

### Cómo está armado, y por qué así

- **La llave es del visitante, no tuya.** Él saca la suya en
  [Google AI Studio](https://aistudio.google.com/apikey), la pega una vez y se
  queda guardada en *su* teléfono. Va derecho de su navegador a Google: no pasa
  por Supabase ni por ningún servidor nuestro. Por eso nadie te puede vaciar la
  cartera generando imágenes.
- **Ojo: esto no es gratis.** Crear la llave no cuesta, pero los modelos de
  imagen de Google **ya no tienen tier gratis**: cobran unos 6.7 centavos de
  dólar (~$1.30 MXN) por imagen y piden tarjeta en la cuenta. En la práctica
  eso significa que el probador es una herramienta **para ti** (pones tu llave
  en tu teléfono y generas fotos para Instagram y WhatsApp), no algo que un
  cliente cualquiera vaya a usar: nadie va a dar de alta una tarjeta en Google
  Cloud para probarse unos tenis.
- **La foto de la persona no se guarda en ningún lado.** Vive en la memoria de
  la pestaña y se borra al cerrarla. No se sube a la base, no se manda a ningún
  otro servicio. El botón "Borrar mis datos" tira también la llave.
- **Las fotos se achican antes de mandarse** (1024 px la persona, 768 px el par,
  JPEG 88%). Una foto de celular pesa 5 MB y son puros píxeles de desperdicio
  que además se cobran.
- **El modelo se escoge solo.** Al guardar la llave se le pregunta a Google qué
  modelos tiene disponibles y se agarra el mejor de imágenes. Si Google retira
  uno, la tienda se pasa sola al siguiente sin tocar código. La lista de
  preferencia está arriba de `src/lib/probador.js`.

### Si algún día quieres pagarlo tú

Para que los clientes no tengan que poner llave, la llave tendría que ser tuya
— y desde el navegador eso es regalarla. Eso ya no va en `src/lib/probador.js`:
va en una función de servidor con la llave guardada como secreto y un freno por
IP, porque si no, cualquiera puede dejarte la cuenta en ceros en una tarde.

## Panel de administración

Está en `/admin`.

- **La primera vez que entras, tú creas la clave.** No hay clave de fábrica y no
  está escrita en el código: se guarda como hash en la base.
- Desde ahí subes pares (marca, modelo, precio, tallas, etiqueta, foto), borras
  los que ya vendiste y cambias tu clave.
- Tras 10 intentos fallidos, el acceso se bloquea 15 minutos.

## Seguridad del catálogo

Cualquiera puede **leer** el catálogo (es una tienda). Para **escribir** no basta
la llave pública: las reglas de la base (RLS) no permiten escribir directo. Solo
se puede a través de funciones del servidor que exigen tu clave. Si alguien saca
la llave publicable del código, no puede alterar tu tienda.

## Configuración

1. `src/config.js`: número de WhatsApp, Instagram, TikTok y Mercado Libre.
2. `src/lib/supabase.js`: URL y llave publicable del proyecto de Supabase.

Si la tienda no logra conectarse con la base, muestra un catálogo de muestra
**avisando en pantalla** que son pares de ejemplo, para no engañar a nadie.

## Desarrollo

```bash
npm install
npm run dev      # servidor local
npm run build    # build de producción
npm run lint     # revisión de código
```

Se publica en Vercel (ver `vercel.json`).
