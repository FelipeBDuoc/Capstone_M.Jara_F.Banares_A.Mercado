(function () {
    const slidesContainer = document.getElementById("carousel-track");
    if (!slidesContainer) return;

    const slides = slidesContainer.children;
    const total = slides.length;
    let index = 0;

    function showSlide(i) {
      index = ((i % total) + total) % total; // normaliza índice
      slidesContainer.style.transform = `translateX(-${index * 100}%)`;
    }

    const nextBtn = document.getElementById("next-btn");
    const prevBtn = document.getElementById("prev-btn");

    nextBtn?.addEventListener("click", () => {
      showSlide(index + 1);
      resetInterval();
    });

    prevBtn?.addEventListener("click", () => {
      showSlide(index - 1);
      resetInterval();
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

    // Inicial
    showSlide(0);
  })();