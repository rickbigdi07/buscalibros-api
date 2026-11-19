"use strict";

/* =========================================================
   ui.js - Componentes de la interfaz creados dinámicamente
   Todo el contenido que viene de la API se inserta con
   textContent / nodos de texto (nunca con innerHTML), así un
   título con etiquetas HTML se muestra como texto y no se ejecuta.
   ========================================================= */

const UI = (() => {
  const refs = {
    estado: document.querySelector("#estado"),
    resultados: document.querySelector("#resultados"),
    resumen: document.querySelector("#resumen"),
    tituloResultados: document.querySelector("#titulo-resultados"),
    paginacion: document.querySelector("#paginacion"),
    btnAnterior: document.querySelector("#btn-anterior"),
    btnSiguiente: document.querySelector("#btn-siguiente"),
    indicador: document.querySelector("#indicador-pagina"),
    detalle: document.querySelector("#detalle"),
    detalleTitulo: document.querySelector("#detalle-titulo"),
    detalleCuerpo: document.querySelector("#detalle-cuerpo")
  };

  /* Ayudante para crear elementos: el = crear("p", { class: "x", text: "Hola" }, hijo1, hijo2) */
  function crear(etiqueta, atributos = {}, ...hijos) {
    const nodo = document.createElement(etiqueta);
    for (const [nombre, valor] of Object.entries(atributos)) {
      if (valor === undefined || valor === null || valor === false) continue;
      if (nombre === "class") nodo.className = valor;
      else if (nombre === "text") nodo.textContent = valor;
      else nodo.setAttribute(nombre, valor === true ? "" : valor);
    }
    nodo.append(...hijos); // los textos se agregan como nodos de texto, no como HTML
    return nodo;
  }

  const formatoNumero = new Intl.NumberFormat("es-MX");

  /* ---------- Portadas ---------- */
  function crearPortadaVacia(texto = "Sin portada") {
    return crear("div", { class: "portada-vacia", text: texto });
  }

  function crearPortada(libro, tamano, clase) {
    const url = OpenLibrary.urlPortada(libro.portadaId, tamano);
    if (!url) return crearPortadaVacia();

    const imagen = crear("img", {
      class: clase,
      src: url,
      alt: `Portada de ${libro.titulo}`,
      width: tamano === "M" ? 180 : 120,
      height: tamano === "M" ? 270 : 180,
      loading: "lazy"
    });
    // Si la imagen no carga, se reemplaza por el recuadro "Sin portada"
    imagen.addEventListener("error", () => imagen.replaceWith(crearPortadaVacia()), { once: true });
    return imagen;
  }

  /* ---------- Estados de la pantalla ---------- */
  function limpiarEstado() {
    refs.estado.replaceChildren();
  }

  function mostrarCargando(texto) {
    refs.estado.replaceChildren(
      crear("div", { class: "estado__caja carga" },
        crear("span", { class: "spinner", "aria-hidden": "true" }),
        crear("span", { text: texto })
      )
    );
    refs.resultados.setAttribute("aria-busy", "true");
  }

  function mostrarVacio(titulo, ayuda) {
    refs.estado.replaceChildren(
      crear("div", { class: "estado__caja" },
        crear("p", { class: "estado__titulo", text: titulo }),
        crear("p", { text: ayuda })
      )
    );
    refs.resultados.setAttribute("aria-busy", "false");
  }

  function mostrarError(mensaje, alReintentar) {
    const boton = crear("button", { class: "boton", type: "button", text: "Reintentar" });
    boton.addEventListener("click", alReintentar);
    refs.estado.replaceChildren(
      crear("div", { class: "estado__caja estado__caja--error", role: "alert" },
        crear("p", { class: "estado__titulo", text: "No pudimos cargar los libros" }),
        crear("p", { text: mensaje }),
        boton
      )
    );
    refs.resultados.setAttribute("aria-busy", "false");
  }

  /* ---------- Resultados ---------- */
  function limpiarResultados() {
    refs.resultados.replaceChildren();
    refs.resumen.textContent = "";
  }

  function crearTarjeta(libro, alSeleccionar) {
    const autores = libro.autores.length ? libro.autores.slice(0, 2).join(", ") : "Autor desconocido";
    const datos = [];
    if (libro.anio) datos.push(`Primera publicación: ${libro.anio}`);
    if (libro.ediciones) datos.push(`${formatoNumero.format(libro.ediciones)} ediciones`);

    const boton = crear("button", {
      class: "boton boton--secundario",
      type: "button",
      text: "Ver detalles",
      "aria-label": `Ver detalles de ${libro.titulo}`
    });
    boton.addEventListener("click", () => alSeleccionar(libro, boton));

    return crear("li", {},
      crear("article", { class: "tarjeta" },
        crearPortada(libro, "M", "tarjeta__portada"),
        crear("div", { class: "tarjeta__cuerpo" },
          crear("h3", { class: "tarjeta__titulo", text: libro.titulo }),
          crear("p", { class: "tarjeta__autor", text: autores }),
          crear("p", { class: "tarjeta__meta", text: datos.join(" · ") || "Sin más datos" }),
          boton
        )
      )
    );
  }

  function mostrarResultados(libros, alSeleccionar) {
    refs.resultados.replaceChildren(...libros.map((libro) => crearTarjeta(libro, alSeleccionar)));
    refs.resultados.setAttribute("aria-busy", "false");
  }

  function mostrarResumen(texto) {
    refs.resumen.textContent = texto;
  }

  function enfocarResultados() {
    refs.tituloResultados.focus();
    refs.tituloResultados.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  /* ---------- Paginación ---------- */
  function ocultarPaginacion() {
    refs.paginacion.hidden = true;
  }

  function actualizarPaginacion(pagina, totalPaginas) {
    refs.paginacion.hidden = totalPaginas <= 1;
    refs.indicador.textContent = `Página ${pagina} de ${formatoNumero.format(totalPaginas)}`;
    refs.btnAnterior.disabled = pagina <= 1;
    refs.btnSiguiente.disabled = pagina >= totalPaginas;
  }

  /* ---------- Ventana de detalle ---------- */
  function abrirDetalleCargando(libro) {
    refs.detalleTitulo.textContent = libro.titulo;
    refs.detalleCuerpo.replaceChildren(
      crear("div", { class: "carga" },
        crear("span", { class: "spinner", "aria-hidden": "true" }),
        crear("span", { text: "Cargando detalles…" })
      )
    );
    if (!refs.detalle.open) refs.detalle.showModal();
  }

  function mostrarDetalle(libro, detalle) {
    const autores = libro.autores.length ? libro.autores.join(", ") : "Autor desconocido";
    const anio = detalle.primeraPublicacion || libro.anio || "No disponible";

    let descripcion = detalle.descripcion || "Esta obra no tiene una descripción en Open Library.";
    if (descripcion.length > 700) descripcion = `${descripcion.slice(0, 700).trimEnd()}…`;

    const datos = crear("div", { class: "detalle__datos" },
      crear("p", {}, crear("strong", { text: "Autor: " }), autores),
      crear("p", {}, crear("strong", { text: "Primera publicación: " }), String(anio)),
      crear("p", {}, crear("strong", { text: "Ediciones registradas: " }), formatoNumero.format(libro.ediciones)),
      crear("h3", { text: "Descripción" }),
      crear("p", { text: descripcion })
    );

    if (detalle.temas.length) {
      datos.append(
        crear("h3", { text: "Temas" }),
        crear("ul", { class: "temas" }, ...detalle.temas.map((tema) => crear("li", { text: tema })))
      );
    }

    datos.append(
      crear("p", {},
        crear("a", {
          href: OpenLibrary.urlFicha(libro.clave),
          target: "_blank",
          rel: "noopener noreferrer",
          text: "Ver la ficha completa en Open Library"
        })
      )
    );

    refs.detalleCuerpo.replaceChildren(
      crear("div", { class: "detalle__ficha" }, crearPortada(libro, "M", "detalle__portada"), datos)
    );
  }

  function mostrarErrorDetalle(mensaje, alReintentar) {
    const boton = crear("button", { class: "boton", type: "button", text: "Reintentar" });
    boton.addEventListener("click", alReintentar);
    refs.detalleCuerpo.replaceChildren(
      crear("div", { class: "estado__caja estado__caja--error", role: "alert" },
        crear("p", { class: "estado__titulo", text: "No pudimos cargar el detalle" }),
        crear("p", { text: mensaje }),
        boton
      )
    );
  }

  return {
    limpiarEstado, mostrarCargando, mostrarVacio, mostrarError,
    limpiarResultados, mostrarResultados, mostrarResumen, enfocarResultados,
    ocultarPaginacion, actualizarPaginacion,
    abrirDetalleCargando, mostrarDetalle, mostrarErrorDetalle,
    elementos: refs
  };
})();
