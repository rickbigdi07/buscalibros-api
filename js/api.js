"use strict";

/* =========================================================
   api.js - Consumo de la API pública de Open Library
   Documentación: https://openlibrary.org/dev/docs/api/search
   No requiere clave ni datos personales.
   ========================================================= */

const OpenLibrary = (() => {
  const URL_BASE = "https://openlibrary.org";
  const URL_PORTADAS = "https://covers.openlibrary.org/b/id";
  const LIBROS_POR_PAGINA = 12;
  const MAX_PAGINAS = 100;        // límite para no mostrar paginaciones enormes
  const TIEMPO_MAXIMO_MS = 12000; // si el servicio tarda más, se muestra un error
  const CAMPOS = "key,title,author_name,first_publish_year,cover_i,edition_count";

  /* Error propio de la aplicación: lleva un mensaje listo para mostrar al usuario */
  class ErrorApi extends Error {
    constructor(mensaje, estado = 0) {
      super(mensaje);
      this.name = "ErrorApi";
      this.estado = estado;
    }
  }

  function mensajeParaEstado(estado) {
    if (estado === 404) return "No se encontró la información solicitada.";
    if (estado === 429) return "Se hicieron demasiadas solicitudes seguidas. Espera unos segundos e inténtalo de nuevo.";
    if (estado >= 500) return "El servicio de Open Library no está disponible en este momento. Inténtalo más tarde.";
    return `El servicio respondió con un error (código ${estado}).`;
  }

  /* Hace la petición con fetch y devuelve el JSON.
     - Cancela la petición si pasa el tiempo máximo.
     - Acepta una señal externa para poder cancelar desde la aplicación. */
  async function obtenerJSON(url, senalExterna) {
    const controlador = new AbortController();
    let agotado = false;
    const temporizador = setTimeout(() => {
      agotado = true;
      controlador.abort();
    }, TIEMPO_MAXIMO_MS);

    if (senalExterna) {
      if (senalExterna.aborted) controlador.abort();
      senalExterna.addEventListener("abort", () => controlador.abort(), { once: true });
    }

    try {
      const respuesta = await fetch(url, {
        signal: controlador.signal,
        headers: { Accept: "application/json" }
      });

      if (!respuesta.ok) {
        throw new ErrorApi(mensajeParaEstado(respuesta.status), respuesta.status);
      }

      try {
        return await respuesta.json();
      } catch (errorJson) {
        if (controlador.signal.aborted) throw errorJson;
        throw new ErrorApi("La respuesta del servicio no tiene el formato esperado.", respuesta.status);
      }
    } catch (error) {
      if (error instanceof ErrorApi) throw error;
      if (agotado) {
        throw new ErrorApi("El servicio tardó demasiado en responder. Inténtalo de nuevo.");
      }
      if (error.name === "AbortError") throw error; // cancelada por la aplicación
      throw new ErrorApi("No se pudo conectar con el servicio. Revisa tu conexión a internet.");
    } finally {
      clearTimeout(temporizador);
    }
  }

  /* Convierte un resultado de la API en un objeto simple para la interfaz */
  function normalizarLibro(doc) {
    return {
      clave: doc.key || "",
      titulo: doc.title || "Sin título",
      autores: Array.isArray(doc.author_name) ? doc.author_name : [],
      anio: doc.first_publish_year ?? null,
      ediciones: doc.edition_count ?? 0,
      portadaId: doc.cover_i ?? null
    };
  }

  /* Endpoint 1: búsqueda -> GET /search.json?q=...&page=...&limit=...&fields=... */
  async function buscarLibros(texto, pagina = 1, senal) {
    const parametros = new URLSearchParams({
      q: texto,
      page: String(pagina),
      limit: String(LIBROS_POR_PAGINA),
      fields: CAMPOS
    });
    const datos = await obtenerJSON(`${URL_BASE}/search.json?${parametros}`, senal);

    const total = Number(datos.numFound) || 0;
    const docs = Array.isArray(datos.docs) ? datos.docs : [];
    return {
      total,
      pagina,
      totalPaginas: Math.min(Math.ceil(total / LIBROS_POR_PAGINA), MAX_PAGINAS),
      libros: docs.map(normalizarLibro)
    };
  }

  /* Endpoint 2: detalle de una obra -> GET /works/{id}.json
     La descripción puede llegar como texto o como objeto { type, value }. */
  async function obtenerDetalle(clave, senal) {
    const datos = await obtenerJSON(`${URL_BASE}${clave}.json`, senal);

    let descripcion = "";
    if (typeof datos.description === "string") descripcion = datos.description;
    else if (datos.description && typeof datos.description.value === "string") descripcion = datos.description.value;

    return {
      descripcion: descripcion.trim(),
      temas: Array.isArray(datos.subjects) ? datos.subjects.slice(0, 8) : [],
      primeraPublicacion: datos.first_publish_date || null
    };
  }

  /* Dirección de la imagen de portada (tamaño S, M o L) */
  function urlPortada(portadaId, tamano = "M") {
    return portadaId ? `${URL_PORTADAS}/${portadaId}-${tamano}.jpg` : null;
  }

  function urlFicha(clave) {
    return `${URL_BASE}${clave}`;
  }

  return { buscarLibros, obtenerDetalle, urlPortada, urlFicha, LIBROS_POR_PAGINA };
})();
