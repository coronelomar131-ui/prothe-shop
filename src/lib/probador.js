// =========================================================================
// EL PROBADOR — ponerte los tenis sin tenerlos
// =========================================================================
// El cliente sube su foto, escoge un par, y una IA de Google le devuelve la
// misma foto pero con esos tenis puestos.
//
// LO IMPORTANTE DE SEGURIDAD, PARA QUE NO SE PIERDA:
//
//   1. La llave es DEL VISITANTE, no tuya. Él la pega, se queda en SU
//      teléfono (localStorage) y se va derechito de su navegador a Google.
//      Nunca pasa por tu Supabase ni por ningún servidor nuestro. Por eso no
//      te puede vaciar la cartera nadie: cada quien paga lo suyo.
//
//   2. La foto de la persona NO se guarda en ningún lado. Vive en la memoria
//      de la pestaña y se borra al cerrarla. Es foto de alguien: no se
//      guarda, no se sube a la base, no se manda a ningún otro servicio.
//
// Si algún día quieres que los clientes no tengan que poner llave (o sea,
// que pagues tú), eso YA NO va aquí: va en una función de servidor con la
// llave guardada como secreto y un freno por IP. Desde el navegador no se
// puede hacer sin regalar la llave.

const API = 'https://generativelanguage.googleapis.com/v1beta';
const CAJON_LLAVE = 'protheProbadorLlave';
const CAJON_MODELO = 'protheProbadorModelo';

// Lo más grande que mandamos. Una foto de celular pesa 5 MB y son 4000 px de
// puro desperdicio: tarda más en subir que en generarse, y se cobra igual.
const LADO_MAX = 1024;

// Cuáles modelos sirven, del que preferimos al que menos. Se escoge el primero
// que la llave del visitante tenga disponible, así que si Google retira uno
// la tienda se pasa sola al siguiente sin que nadie toque código.
const PREFERIDOS = [
    'gemini-3.1-flash-image',     // nano banana 2: rápido y barato
    'gemini-nano-banana-2.1',
    'gemini-3.1-flash-lite-image',
    'gemini-3-pro-image',         // el mejor, pero más caro
    'gemini-2.5-flash-image',     // el viejito, por si acaso
];

// En inglés a propósito: los modelos de imagen obedecen bastante mejor el
// prompt en inglés. Todo lo que ve el cliente sigue en español.
const INSTRUCCION = [
    'Photo-realistic image edit.',
    'Image 1 is a photo of a person. Image 2 is a product photo of a pair of sneakers.',
    'Replace ONLY the footwear in image 1 with the exact sneakers from image 2.',
    "Keep the person's face, hair, skin tone, body, clothing, pose and the background",
    'completely unchanged and identical to image 1.',
    'Match the real colorway, materials, logos and silhouette of the sneakers in image 2.',
    'Place them on both feet with correct perspective, scale, contact shadows and',
    'lighting consistent with image 1.',
    'Return the edited photograph only.',
].join(' ');

// ---------- la llave del visitante ----------

export const leerLlave = () => {
    try { return localStorage.getItem(CAJON_LLAVE) || ''; } catch { return ''; }
};

export const guardarLlave = (llave, modelo) => {
    try {
        localStorage.setItem(CAJON_LLAVE, llave);
        if (modelo) localStorage.setItem(CAJON_MODELO, modelo);
    } catch { /* modo privado: funciona igual, solo no se acuerda */ }
};

export const leerModelo = () => {
    try { return localStorage.getItem(CAJON_MODELO) || ''; } catch { return ''; }
};

export const olvidarTodo = () => {
    try {
        localStorage.removeItem(CAJON_LLAVE);
        localStorage.removeItem(CAJON_MODELO);
    } catch { /* ni modo */ }
};

// ---------- fotos ----------

// Achica y vuelve JPEG. Devuelve { mimeType, data } con el base64 pelón, que
// es como lo pide Google (sin el "data:image/jpeg;base64," de adelante).
export const achicar = (fuente, lado = LADO_MAX) => new Promise((listo, falla) => {
    const img = new Image();
    img.onload = () => {
        const escala = Math.min(1, lado / Math.max(img.width, img.height));
        const lienzo = document.createElement('canvas');
        lienzo.width = Math.max(1, Math.round(img.width * escala));
        lienzo.height = Math.max(1, Math.round(img.height * escala));
        const ctx = lienzo.getContext('2d');
        // fondo blanco: si la foto es PNG con transparencia, al pasarla a JPEG
        // lo transparente se pondría negro.
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, lienzo.width, lienzo.height);
        ctx.drawImage(img, 0, 0, lienzo.width, lienzo.height);
        const url = lienzo.toDataURL('image/jpeg', 0.88);
        listo({ mimeType: 'image/jpeg', data: url.split(',')[1], url });
    };
    img.onerror = () => falla(new Error('No se pudo leer esa imagen'));
    img.src = fuente;
});

export const archivoAUrl = (archivo) => new Promise((listo, falla) => {
    const lector = new FileReader();
    lector.onload = () => listo(String(lector.result));
    lector.onerror = () => falla(new Error('No se pudo abrir el archivo'));
    lector.readAsDataURL(archivo);
});

// ---------- Google ----------

const pedir = async (ruta, llave, opciones = {}) => {
    let r;
    try {
        r = await fetch(`${API}${ruta}`, {
            ...opciones,
            headers: { 'x-goog-api-key': llave, 'Content-Type': 'application/json', ...(opciones.headers || {}) },
        });
    } catch {
        const e = new Error('sin-red');
        e.clase = 'red';
        throw e;
    }
    const cuerpo = await r.json().catch(() => ({}));
    if (!r.ok) {
        const e = new Error(cuerpo?.error?.message || `Error ${r.status}`);
        e.codigo = r.status;
        e.estado = cuerpo?.error?.status || '';
        throw e;
    }
    return cuerpo;
};

// Revisa la llave Y de paso escoge el modelo. Un solo viaje para las dos
// cosas: así el visitante sabe al instante si su llave sirve.
export const revisarLlave = async (llave) => {
    const cuerpo = await pedir('/models?pageSize=1000', llave);
    const nombres = (cuerpo.models || [])
        .filter(m => (m.supportedGenerationMethods || []).includes('generateContent'))
        .map(m => String(m.name || '').replace(/^models\//, ''));

    const escogido =
        PREFERIDOS.find(p => nombres.includes(p)) ||
        // si Google les cambió el nombre otra vez, agarramos cualquiera que
        // diga "image" y no sea de los que solo entienden imágenes.
        nombres.find(n => /image|banana/i.test(n) && !/embed|understand/i.test(n));

    if (!escogido) {
        const e = new Error('sin-modelo');
        e.clase = 'sin-modelo';
        throw e;
    }
    return escogido;
};

// La buena: foto de la persona + foto del par -> foto de la persona con el par.
export const probarTenis = async ({ llave, modelo, persona, tenis }) => {
    const cuerpo = await pedir(`/models/${encodeURIComponent(modelo)}:generateContent`, llave, {
        method: 'POST',
        body: JSON.stringify({
            contents: [{
                role: 'user',
                parts: [
                    { text: INSTRUCCION },
                    { inlineData: { mimeType: persona.mimeType, data: persona.data } },
                    { inlineData: { mimeType: tenis.mimeType, data: tenis.data } },
                ],
            }],
            generationConfig: {
                // TEXT+IMAGE es la combinación que aceptan todos; si pidiéramos
                // solo IMAGE, los modelos que no la soportan tiran error.
                responseModalities: ['TEXT', 'IMAGE'],
                imageConfig: { aspectRatio: '3:4', imageSize: '1K' },
            },
        }),
    });

    const partes = cuerpo?.candidates?.[0]?.content?.parts || [];
    const imagen = partes.find(p => p?.inlineData?.data);
    if (!imagen) {
        const e = new Error('sin-imagen');
        e.clase = 'sin-imagen';
        // Cuando no quiere, a veces explica por qué en texto.
        e.explicacion = partes.find(p => p?.text)?.text || '';
        e.motivo = cuerpo?.candidates?.[0]?.finishReason || '';
        throw e;
    }
    return `data:${imagen.inlineData.mimeType || 'image/png'};base64,${imagen.inlineData.data}`;
};

// ---------- traducir los errores a cristiano ----------

export const explicarFalla = (err) => {
    if (err?.clase === 'red') return 'No hay internet, o se cayó la conexión con Google. Vuelve a intentar.';
    if (err?.clase === 'sin-modelo') return 'Tu llave sirve, pero no tiene ningún modelo de imágenes activo. Entra a Google AI Studio y revisa que la cuenta tenga facturación encendida.';
    if (err?.clase === 'sin-imagen') {
        return err.motivo === 'SAFETY' || /safety|policy|blocked/i.test(err.explicacion || '')
            ? 'Google no quiso generar esa imagen. Suele pasar con fotos de menores o donde se ve poca ropa. Prueba con otra foto.'
            : 'Esta vez no salió ninguna imagen. Vuelve a darle, a veces a la segunda sí.';
    }
    const texto = err?.message || '';
    if (err?.codigo === 400 && /API key not valid|API_KEY_INVALID/i.test(texto)) {
        return 'Esa llave no sirve. Revisa que la hayas copiado completa, sin espacios.';
    }
    if (err?.codigo === 400) return 'Google rechazó la foto. Que sea JPG o PNG y que no esté corrupta.';
    if (err?.codigo === 403) return 'Tu llave existe pero no tiene permiso. En Google AI Studio revisa que la API esté habilitada y que la llave no esté limitada a otro sitio.';
    if (err?.codigo === 404) return 'Ese modelo ya no existe. Borra tu llave aquí abajo y vuelve a ponerla para que escoja uno nuevo.';
    if (err?.codigo === 429) return 'Te pasaste del límite de Google por ahora. Espera un rato, o revisa tu facturación.';
    if (err?.codigo >= 500) return 'Google anda fallando en este momento. Intenta en un rato.';
    return texto || 'Algo salió mal.';
};

export const LADO_MAXIMO = LADO_MAX;
