import React, { useState, useCallback, useRef } from 'react';
import { ProbadorContext } from './probador-context';
import { fetchPhoto } from '../lib/shopApi';
import {
    leerLlave, leerModelo, guardarLlave, olvidarTodo,
    revisarLlave, probarTenis, achicar, archivoAUrl, explicarFalla,
} from '../lib/probador';

// El estado del probador. Vive aparte del carrito porque son dos cosas
// distintas: el carrito se guarda, el probador no deja rastro.
export const ProbadorProvider = ({ children }) => {
    const [abierto, setAbierto] = useState(false);
    const [llave, setLlave] = useState(leerLlave);
    const [modelo, setModelo] = useState(leerModelo);
    const [revisando, setRevisando] = useState(false);

    // La foto de la persona NO se guarda: vive aquí mientras la pestaña esté
    // abierta y se va al cerrarla. Es la foto de alguien.
    const [personaUrl, setPersonaUrl] = useState(null);
    const personaChica = useRef(null);

    const [par, setPar] = useState(null);          // el par que se va a probar
    const [pruebas, setPruebas] = useState([]);    // lo que ya salió, para comparar
    const [activa, setActiva] = useState(0);
    const [trabajando, setTrabajando] = useState(false);
    const [falla, setFalla] = useState(null);

    const abrir = useCallback((producto = null) => {
        if (producto) setPar(producto);
        setFalla(null);
        setAbierto(true);
    }, []);

    const cerrar = useCallback(() => setAbierto(false), []);

    const ponerLlave = useCallback(async (texto) => {
        const limpia = (texto || '').trim();
        if (!limpia) return;
        setRevisando(true);
        setFalla(null);
        try {
            const elegido = await revisarLlave(limpia);
            guardarLlave(limpia, elegido);
            setLlave(limpia);
            setModelo(elegido);
        } catch (err) {
            setFalla(explicarFalla(err));
        } finally {
            setRevisando(false);
        }
    }, []);

    const ponerFoto = useCallback(async (archivo) => {
        if (!archivo) return;
        setFalla(null);
        try {
            const url = await archivoAUrl(archivo);
            const chica = await achicar(url);
            personaChica.current = chica;
            setPersonaUrl(chica.url);
        } catch (err) {
            setFalla(explicarFalla(err));
        }
    }, []);

    const quitarFoto = useCallback(() => {
        personaChica.current = null;
        setPersonaUrl(null);
    }, []);

    const generar = useCallback(async () => {
        if (!llave || !modelo || !personaChica.current || !par) return;
        setTrabajando(true);
        setFalla(null);
        try {
            const fotoPar = par.foto || await fetchPhoto(par.id);
            if (!fotoPar) throw Object.assign(new Error('sin-foto'), { clase: 'sin-imagen' });
            const tenis = await achicar(fotoPar, 768);

            const url = await probarTenis({
                llave, modelo,
                persona: personaChica.current,
                tenis,
            });

            setPruebas(prev => {
                const siguiente = [...prev, {
                    id: `${par.id}-${Date.now()}`,
                    producto: par,
                    url,
                }];
                setActiva(siguiente.length - 1);
                return siguiente;
            });
        } catch (err) {
            setFalla(explicarFalla(err));
        } finally {
            setTrabajando(false);
        }
    }, [llave, modelo, par]);

    const borrarPrueba = useCallback((id) => {
        setPruebas(prev => {
            const siguiente = prev.filter(p => p.id !== id);
            setActiva(a => Math.max(0, Math.min(a, siguiente.length - 1)));
            return siguiente;
        });
    }, []);

    // El botón de pánico: se va la llave, la foto y todo lo generado.
    const borrarTodo = useCallback(() => {
        olvidarTodo();
        personaChica.current = null;
        setLlave('');
        setModelo('');
        setPersonaUrl(null);
        setPruebas([]);
        setActiva(0);
        setPar(null);
        setFalla(null);
    }, []);

    return (
        <ProbadorContext.Provider value={{
            abierto, abrir, cerrar,
            llave, modelo, revisando, ponerLlave,
            personaUrl, ponerFoto, quitarFoto,
            par, setPar,
            pruebas, activa, setActiva, borrarPrueba,
            trabajando, falla, setFalla,
            generar, borrarTodo,
            listo: !!llave && !!personaUrl,
        }}>
            {children}
        </ProbadorContext.Provider>
    );
};
