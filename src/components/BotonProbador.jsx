import React, { useContext } from 'react';
import { ProbadorContext } from '../context/probador-context';
import { ShopContext } from '../context/shop-context';

// El botón flotante. Solo aparece si hay al menos un par con foto, porque sin
// foto el probador no tiene con qué trabajar y sería un botón que no sirve.
const BotonProbador = () => {
    const { abierto, abrir, pruebas } = useContext(ProbadorContext);
    const { products } = useContext(ShopContext);

    if (abierto) return null;
    if (!products.some(p => p.hasPhoto)) return null;

    return (
        <button className="prob-flota" onClick={() => abrir()} aria-label="Abrir el probador">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"
                strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M12 7a2 2 0 1 1 2-2" />
                <path d="M12 7v2.3L3.7 15.4a1.2 1.2 0 0 0 .7 2.2h15.2a1.2 1.2 0 0 0 .7-2.2L12 9.3" />
            </svg>
            <span>Probador</span>
            {pruebas.length > 0 && <em>{pruebas.length}</em>}
        </button>
    );
};

export default BotonProbador;
