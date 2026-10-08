import React, { useContext, useEffect, useRef, useState } from 'react';
import { ProbadorContext } from '../context/probador-context';
import { ShopContext } from '../context/shop-context';
import { waLink } from '../lib/whatsapp';
import { fetchPhoto } from '../lib/shopApi';

// Lo que se le dice al cliente mientras espera. Tarda entre 10 y 30 segundos:
// una barra sola aburre, y si no pasa nada en pantalla la gente se sale.
const AVISOS = [
    'Mandando tu foto…',
    'Midiéndote el pie…',
    'Poniéndote los tenis…',
    'Cuadrando luz y sombras…',
    'Dando los últimos toques…',
];

// Se monta cuando empieza a trabajar y se desmonta al acabar, por eso el
// contador siempre arranca en cero sin tener que acordarse de reiniciarlo.
const Cargando = () => {
    const [aviso, setAviso] = useState(0);
    useEffect(() => {
        const t = setInterval(() => setAviso(a => Math.min(a + 1, AVISOS.length - 1)), 3200);
        return () => clearInterval(t);
    }, []);
    return (
        <div className="prob-cargando">
            <div className="prob-tira"><span /></div>
            <p>{AVISOS[aviso]}</p>
            <small>Tarda entre 10 y 30 segundos</small>
        </div>
    );
};

const Icono = ({ d, ...resto }) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
        strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...resto}>
        <path d={d} />
    </svg>
);

const WhatsAppIcon = () => (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M12 2C6.48 2 2 6.48 2 12c0 1.85.5 3.58 1.38 5.07L2 22l5.07-1.33A9.94 9.94 0 0012 22c5.52 0 10-4.48 10-10S17.52 2 12 2z" />
    </svg>
);

const Probador = () => {
    const {
        abierto, cerrar,
        llave, modelo, revisando, ponerLlave,
        personaUrl, ponerFoto, quitarFoto,
        par, setPar,
        pruebas, activa, setActiva, borrarPrueba,
        trabajando, falla, setFalla,
        generar, borrarTodo,
    } = useContext(ProbadorContext);
    const { products, addToCart } = useContext(ShopContext);

    const [textoLlave, setTextoLlave] = useState('');
    const archivo = useRef(null);
    const panel = useRef(null);

    // Escape cierra, y mientras está abierto la página de atrás no se mueve.
    useEffect(() => {
        if (!abierto) return;
        const tecla = (e) => { if (e.key === 'Escape') cerrar(); };
        const antes = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        window.addEventListener('keydown', tecla);
        panel.current?.focus();
        return () => {
            document.body.style.overflow = antes;
            window.removeEventListener('keydown', tecla);
        };
    }, [abierto, cerrar]);

    if (!abierto) return null;

    const prueba = pruebas[activa] || null;
    const conFoto = products.filter(p => p.hasPhoto);

    const descargar = (p) => {
        const a = document.createElement('a');
        a.href = p.url;
        a.download = `prothe-${p.producto.brand}-${p.producto.name}`.replace(/[^\w-]+/g, '-').toLowerCase() + '.png';
        document.body.appendChild(a);
        a.click();
        a.remove();
    };

    // En celular esto abre el menú de compartir y puede ir derecho a WhatsApp
    // con la imagen pegada. Donde no exista, al menos la descarga.
    const compartir = async (p) => {
        try {
            const blob = await (await fetch(p.url)).blob();
            const file = new File([blob], 'probador.png', { type: blob.type || 'image/png' });
            if (navigator.canShare?.({ files: [file] })) {
                await navigator.share({
                    files: [file],
                    text: `Así me quedan los ${p.producto.brand} ${p.producto.name}`,
                });
                return;
            }
        } catch { /* lo canceló, o el navegador no puede: cae a descargar */ }
        descargar(p);
    };

    return (
        <>
            <div className="prob-overlay" onClick={cerrar} />
            <aside className="prob-panel" ref={panel} tabIndex={-1}
                role="dialog" aria-modal="true" aria-label="Probador virtual">

                <div className="prob-head">
                    <div>
                        <h3>El probador</h3>
                        <span>Pruébatelos sin tenerlos</span>
                    </div>
                    <button className="prob-cerrar" onClick={cerrar} aria-label="Cerrar probador">×</button>
                </div>

                <div className="prob-cuerpo">

                    {/* ---------- PASO 1: la llave ---------- */}
                    {!llave && (
                        <div className="prob-paso">
                            <span className="prob-num">01</span>
                            <h4>Tu llave de Google</h4>
                            <p className="prob-dice">
                                El probador usa la IA de Google y cada quien pone la suya.
                                Crearla no cuesta, pero Google cobra la imagen: como
                                <strong> $1.30 por prueba</strong>, y pide tarjeta en la cuenta.
                            </p>
                            <a className="prob-liga" href="https://aistudio.google.com/apikey"
                                target="_blank" rel="noreferrer">
                                Sacar mi llave en Google AI Studio →
                            </a>
                            <form className="prob-llave" onSubmit={(e) => { e.preventDefault(); ponerLlave(textoLlave); }}>
                                <input
                                    type="password"
                                    value={textoLlave}
                                    onChange={(e) => setTextoLlave(e.target.value)}
                                    placeholder="Pega aquí tu llave"
                                    autoComplete="off"
                                    spellCheck="false"
                                    aria-label="Tu llave de Google"
                                />
                                <button type="submit" disabled={revisando || !textoLlave.trim()}>
                                    {revisando ? 'Revisando…' : 'Guardar'}
                                </button>
                            </form>
                            <p className="prob-nota">
                                Se queda en tu teléfono y va directo de aquí a Google.
                                Ni Prothe ni nadie más la ve.
                            </p>
                        </div>
                    )}

                    {/* ---------- PASO 2: la foto ---------- */}
                    {llave && !personaUrl && (
                        <div className="prob-paso">
                            <span className="prob-num">02</span>
                            <h4>Tu foto</h4>
                            <p className="prob-dice">
                                De cuerpo completo y de pie, con los pies a la vista.
                                Entre mejor se vean, mejor quedan.
                            </p>
                            <button className="prob-subir" onClick={() => archivo.current?.click()}>
                                <Icono d="M12 16V4m0 0L7 9m5-5 5 5M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
                                Subir o tomar foto
                            </button>
                            <input
                                ref={archivo}
                                type="file"
                                accept="image/*"
                                hidden
                                onChange={(e) => { ponerFoto(e.target.files?.[0]); e.target.value = ''; }}
                            />
                            <p className="prob-nota">
                                Tu foto no se guarda en ningún lado: vive mientras tengas
                                esta pestaña abierta y se borra al cerrarla.
                            </p>
                        </div>
                    )}

                    {/* ---------- PASO 3: a probar ---------- */}
                    {llave && personaUrl && (
                        <>
                            <div className="prob-escenario">
                                {trabajando ? (
                                    <Cargando />
                                ) : prueba ? (
                                    <figure className="prob-resultado">
                                        <img src={prueba.url} alt={`Tú con los ${prueba.producto.brand} ${prueba.producto.name}`} />
                                        <figcaption>
                                            {prueba.producto.brand} {prueba.producto.name}
                                            <strong>${prueba.producto.price.toLocaleString('es-MX')}</strong>
                                        </figcaption>
                                    </figure>
                                ) : (
                                    <figure className="prob-resultado prob-tuya">
                                        <img src={personaUrl} alt="Tu foto" />
                                        <figcaption>Esta eres tú. Escoge un par abajo.</figcaption>
                                    </figure>
                                )}
                            </div>

                            {/* lo que ya probaste, para comparar */}
                            {pruebas.length > 0 && (
                                <div className="prob-tiras">
                                    {pruebas.map((p, i) => (
                                        <div className="prob-mini-caja" key={p.id}>
                                            <button
                                                className={`prob-mini${i === activa ? ' viva' : ''}`}
                                                onClick={() => setActiva(i)}
                                                aria-label={`Ver ${p.producto.brand} ${p.producto.name}`}
                                                aria-current={i === activa}
                                            >
                                                <img src={p.url} alt="" />
                                            </button>
                                            <button
                                                className="prob-mini-x"
                                                onClick={() => borrarPrueba(p.id)}
                                                aria-label={`Borrar la prueba de ${p.producto.brand} ${p.producto.name}`}
                                            >×</button>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* acciones de la prueba que se está viendo */}
                            {prueba && !trabajando && (
                                <div className="prob-acciones">
                                    <button onClick={() => compartir(prueba)}>
                                        <Icono d="M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7M12 15V3m0 0L8 7m4-4 4 4" />
                                        Compartir
                                    </button>
                                    <button onClick={() => { addToCart(prueba.producto, null); }}>
                                        <Icono d="M6 6h15l-1.5 9h-12zM6 6 5 2H2m4 17a1 1 0 1 0 2 0 1 1 0 0 0-2 0m10 0a1 1 0 1 0 2 0 1 1 0 0 0-2 0" />
                                        Al carrito
                                    </button>
                                    <a
                                        href={waLink(`Hola, me probé los ${prueba.producto.brand} ${prueba.producto.name} en el probador de la página y me gustaron. ¿Qué tallas tienes?`)}
                                        target="_blank" rel="noreferrer"
                                    >
                                        <WhatsAppIcon />
                                        Apartar
                                    </a>
                                </div>
                            )}

                            {/* escoger el par */}
                            <div className="prob-pares">
                                <div className="prob-pares-head">
                                    <h5>Escoge el par</h5>
                                    {par && <span>{par.brand} {par.name}</span>}
                                </div>
                                {conFoto.length === 0 ? (
                                    <p className="prob-nota">
                                        Todavía no hay pares con foto. El probador necesita la foto
                                        del par para poder ponértelo.
                                    </p>
                                ) : (
                                    <div className="prob-fila">
                                        {conFoto.map(p => (
                                            <button
                                                key={p.id}
                                                className={`prob-par${par?.id === p.id ? ' viva' : ''}`}
                                                onClick={() => { setPar(p); setFalla(null); }}
                                                aria-pressed={par?.id === p.id}
                                            >
                                                <ParFoto producto={p} />
                                                <span>{p.brand}</span>
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </>
                    )}

                    {falla && <p className="prob-falla" role="alert">{falla}</p>}
                </div>

                {/* ---------- el botón grande ---------- */}
                {llave && personaUrl && (
                    <div className="prob-pie">
                        <button
                            className="prob-ir"
                            onClick={generar}
                            disabled={trabajando || !par}
                        >
                            {trabajando ? 'Probándote…' : par ? 'Probármelos' : 'Escoge un par'}
                        </button>
                        <div className="prob-pie-links">
                            <button onClick={quitarFoto}>Cambiar mi foto</button>
                            <button onClick={borrarTodo}>Borrar mis datos</button>
                            {modelo && <span className="prob-modelo">{modelo}</span>}
                        </div>
                    </div>
                )}
            </aside>
        </>
    );
};

// La miniatura del par dentro del probador. Pide la foto una sola vez.
const ParFoto = ({ producto }) => {
    const [src, setSrc] = useState(producto.foto || null);
    useEffect(() => {
        if (src) return;
        let vivo = true;
        fetchPhoto(producto.id)
            .then(d => { if (vivo && d) setSrc(d); })
            .catch(() => { /* se queda el hueco */ });
        return () => { vivo = false; };
    }, [producto.id, src]);
    return <span className="prob-par-foto">{src ? <img src={src} alt="" /> : null}</span>;
};

export default Probador;
