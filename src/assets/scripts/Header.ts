document.addEventListener("DOMContentLoaded", () => {
  // --- USER MENU ---
  const userMenuButton = document.getElementById("user-menu-button");
  const userMenu = document.getElementById("user-dropdown");

  if (userMenuButton && userMenu) {
    userMenuButton.addEventListener("click", (event) => {
      event.stopPropagation();
      const isOpen = userMenuButton.getAttribute("aria-expanded") === "true";
      userMenuButton.setAttribute("aria-expanded", (!isOpen).toString());
      userMenu.classList.toggle("hidden", isOpen);
    });

    // Cerrar el menú si se hace clic fuera
    document.addEventListener("click", (event) => {
      if (
        !userMenuButton.contains(event.target as Node) &&
        !userMenu.contains(event.target as Node)
      ) {
        userMenu.classList.add("hidden");
        userMenuButton.setAttribute("aria-expanded", "false");
      }
    });
  }

  // --- MOBILE MENU ---
  const mobileMenuButton = document.querySelector(
    '[aria-controls="mobile-menu"]'
  ) as HTMLButtonElement | null;
  const mobileMenu = document.getElementById("mobile-menu");

  if (mobileMenuButton && mobileMenu) {
    const [iconOpen, iconClose] = mobileMenuButton.querySelectorAll("svg");

    mobileMenu.classList.add("hidden");
    mobileMenuButton.setAttribute("aria-expanded", "false");

    mobileMenuButton.addEventListener("click", () => {
      const isOpen = mobileMenuButton.getAttribute("aria-expanded") === "true";

      mobileMenuButton.setAttribute("aria-expanded", (!isOpen).toString());
      mobileMenu.classList.toggle("hidden", isOpen);

      // Iconos del botón hamburguesa
      iconOpen.classList.toggle("hidden", !isOpen); // mostrar cuando cerrado
      iconClose.classList.toggle("hidden", isOpen); // mostrar cuando abierto
    });
  }
  const userDropdown = document.getElementById("user-dropdown");

  const isLoggedIn = localStorage.getItem("isLoggedIn") === "true";
  const userRole = localStorage.getItem("userRole");

  const updateUserMenu = () => {
    if (!userDropdown) return;

    userDropdown.innerHTML = isLoggedIn
      ? `
        <a href="/profile" class="block px-4 py-2 text-sm text-white">Tu perfil</a>
        ${userRole === "admin" ? `<a href="/admin" class="block px-4 py-2 text-sm text-red-600">Administración</a>` : ""}
        <a href="#" id="logout-link" class="block px-4 py-2 text-sm text-white">Cerrar sesión</a>
      `
      : `
        <a href="/login" class="block px-4 py-2 text-sm text-white">Iniciar sesión</a>
      `;

    if (isLoggedIn) {
      const logoutLink = document.getElementById("logout-link");
      logoutLink?.addEventListener("click", (e) => {
        e.preventDefault();
        localStorage.removeItem("isLoggedIn");
        localStorage.removeItem("userRole");
        window.location.href = "/";
      });
    }
  };

  const notifButton = document.getElementById("notif-button");
  const notifMenu = document.getElementById("notif-menu");

    if (notifButton && notifMenu) {
      // Mostrar el botón solo si el usuario está logeado
      notifButton.classList.toggle("hidden", !isLoggedIn);

      // Alternar visibilidad del menú al hacer clic en el botón
      notifButton.addEventListener("click", (e) => {
        e.stopPropagation(); // Evita que el clic se propague y cierre el menú inmediatamente
        const isVisible = !notifMenu.classList.contains("hidden");
        notifMenu.classList.toggle("hidden", isVisible);
      });
    }
  if (userMenuButton && userDropdown) {
    userMenuButton.addEventListener("click", (e) => {
      e.stopPropagation();
      userDropdown.classList.toggle("hidden");
    });

    document.addEventListener("click", (e) => {
      if (
        !userMenuButton.contains(e.target) &&
        !userDropdown.contains(e.target)
      ) {
        userDropdown.classList.add("hidden");
      }
    });
  }

  updateUserMenu();
  });