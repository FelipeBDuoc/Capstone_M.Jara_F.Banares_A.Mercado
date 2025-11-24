(function () {
  const slidesContainer = document.getElementById("carousel-track");
  const dots = document.querySelectorAll(".carousel-dot"); // Seleccionamos los puntos
  
  if (!slidesContainer) return;

  const slides = slidesContainer.children;
  const total = slides.length;
  let index = 0;

  function showSlide(i) {
    index = ((i % total) + total) % total; // normaliza índice

    // 1. Mover el carrusel
    slidesContainer.style.transform = `translateX(-${index * 100}%)`;

    // 2. Actualizar los puntos (Dots)
    dots.forEach((dot, dotIndex) => {
      if (dotIndex === index) {
        // Activo: Color #00ffbb, opaco y un poco más grande
        dot.classList.remove("bg-white", "opacity-50");
        dot.classList.add("bg-[#00ffbb]", "opacity-100", "scale-110");
      } else {
        // Inactivo: Blanco, semi-transparente
        dot.classList.add("bg-white", "opacity-50");
        dot.classList.remove("bg-[#00ffbb]", "opacity-100", "scale-110");
      }
    });
  }

  const nextBtn = document.getElementById("next-btn");
  const prevBtn = document.getElementById("prev-btn");

  // Evento Click Siguiente
  nextBtn?.addEventListener("click", () => {
    showSlide(index + 1);
    resetInterval();
  });

  // Evento Click Anterior
  prevBtn?.addEventListener("click", () => {
    showSlide(index - 1);
    resetInterval();
  });

  // Evento Click en los Puntos (Navegación directa)
  dots.forEach((dot) => {
    dot.addEventListener("click", (e) => {
      // Obtenemos el índice del atributo data-index del HTML
      const newIndex = parseInt(e.target.getAttribute("data-index"));
      showSlide(newIndex);
      resetInterval();
    });
  });

  // Auto-avance cada 5s
  let interval = setInterval(() => showSlide(index + 1), 5000);

  function resetInterval() {
    clearInterval(interval);
    interval = setInterval(() => showSlide(index + 1), 5000);
  }

  // Ajusta el ancho de cada slide
  Array.from(slides).forEach((slide) => {
    slide.style.minWidth = "100%";
  });

  // Inicializar
  showSlide(0);
})();