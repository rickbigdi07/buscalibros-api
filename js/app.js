"use strict";

/* =========================================================
   app.js - Lógica de la aplicación
   Conecta el formulario y los botones con la API (api.js)
   y con los componentes de la interfaz (ui.js).
   ========================================================= */

(() => {
  const BUSQUEDA_INICIAL = "Gabriel García Márquez";

  /* Estado de la aplicación */
  const estado = {
    consulta: "",
    pagina: 1,
    total: 0,
    totalPaginas: 0,
    libros: [],
    soloPortada: false,
    controladorBusqueda: null,
    controladorDetalle: null
  };

  const formulario = document.querySelector("#formulario");
  const campoConsulta = document.querySelector("#consulta");
  const casillaPortada = document.querySelector("#solo-portada");
  const { btnAnterior, btnSiguiente, detalle } = UI.elementos;

  /* ---------- Búsqueda ---------- */
  async function buscar(consulta, pagina = 1, moverFoco = false) {
    // Si había una búsqueda en curso, se cancela para que no pise a la nueva
    if (estado.controladorBusqueda) estado.controladorBusqueda.abort();
    const controlador = new AbortController();
    estado.controladorBusqueda = controlador;

    UI.limpiarResultados();
    UI.ocultarPaginacion();
    UI.mostrarCargando(`Buscando «${consulta}»…`);

    try {
      const resultado = await OpenLibrary.buscarLibros(consulta, pagina, controlador.signal);
      if (controlador !== estado.controladorBusqueda) return; // llegó tarde

      estado.consulta = consulta;
      estado.pagina = resultado.pagina;
      estado.total = resultado.total;
      estado.totalPaginas = resultado.totalPaginas;
      estado.libros = resultado.libros;

      pintarResultados();
      if (moverFoco) UI.enfocarResultados();
    } catch (error) {
      if (error.name === "AbortError") return; // cancelada por una búsqueda nueva
      if (controlador !== estado.controladorBusqueda) return;
      UI.mostrarError(error.message, () => buscar(consulta, pagina, moverFoco));
    }
  }

  /* Muestra en pantalla lo que hay en el estado (también aplica el filtro de portada) */
  function pintarResultados() {
    if (estado.total === 0) {
      UI.mostrarVacio(
        `No encontramos libros para «${estado.consulta}»`,
        "Revisa la ortografía o prueba con otras palabras."
      );
      UI.ocultarPaginacion();
      return;
    }

    const visibles = estado.soloPortada
      ? estado.libros.filter((libro) => libro.portadaId)
      : estado.libros;

    const totalTexto = estado.total.toLocaleString("es-MX");
    UI.mostrarResumen(`${totalTexto} libros encontrados para «${estado.consulta}».`);
    UI.actualizarPaginacion(estado.pagina, estado.totalPaginas);

    if (visibles.length === 0) {
      UI.mostrarVacio(
        "Ningún libro de esta página tiene portada",
        "Desmarca el filtro o pasa a otra página."
      );
      UI.mostrarResultados([], seleccionarLibro);
      return;
    }

    UI.limpiarEstado();
    UI.mostrarResultados(visibles, seleccionarLibro);
  }

  /* ---------- Detalle del libro seleccionado ---------- */
  async function seleccionarLibro(libro) {
    if (estado.controladorDetalle) estado.controladorDetalle.abort();
    const controlador = new AbortController();
    estado.controladorDetalle = controlador;

    UI.abrirDetalleCargando(libro);

    try {
      const datos = await OpenLibrary.obtenerDetalle(libro.clave, controlador.signal);
      if (controlador !== estado.controladorDetalle) return;
      UI.mostrarDetalle(libro, datos);
    } catch (error) {
      if (error.name === "AbortError") return;
      if (controlador !== estado.controladorDetalle) return;
      UI.mostrarErrorDetalle(error.message, () => seleccionarLibro(libro));
    }
  }

  /* ---------- Eventos ---------- */
  formulario.addEventListener("submit", (evento) => {
    evento.preventDefault();
    const consulta = campoConsulta.value.trim();
    if (consulta.length < 2) {
      campoConsulta.focus();
      return;
    }
    buscar(consulta, 1);
  });

  // Búsquedas sugeridas
  document.querySelectorAll(".chip").forEach((chip) => {
    chip.addEventListener("click", () => {
      campoConsulta.value = chip.dataset.consulta;
      buscar(chip.dataset.consulta, 1);
    });
  });

  // Filtro: solo libros con portada (se aplica sin volver a pedir datos)
  casillaPortada.addEventListener("change", () => {
    estado.soloPortada = casillaPortada.checked;
    if (estado.libros.length || estado.total) pintarResultados();
  });

  // Paginación
  btnAnterior.addEventListener("click", () => {
    if (estado.pagina > 1) buscar(estado.consulta, estado.pagina - 1, true);
  });

  btnSiguiente.addEventListener("click", () => {
    if (estado.pagina < estado.totalPaginas) buscar(estado.consulta, estado.pagina + 1, true);
  });

  // Al cerrar la ventana de detalle se cancela la petición pendiente
  detalle.addEventListener("close", () => {
    if (estado.controladorDetalle) estado.controladorDetalle.abort();
  });

  // Cerrar el detalle al hacer clic fuera de la ventana
  detalle.addEventListener("click", (evento) => {
    if (evento.target === detalle) detalle.close();
  });

  /* ---------- Inicio ---------- */
  campoConsulta.value = BUSQUEDA_INICIAL;
  buscar(BUSQUEDA_INICIAL, 1);
})();
