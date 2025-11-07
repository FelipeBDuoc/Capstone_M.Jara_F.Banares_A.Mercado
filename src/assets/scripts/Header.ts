document.addEventListener("DOMContentLoaded", () => {
  
  const userMenuButton = document.getElementById("user-menu-button");
  const userMenu = document.getElementById("user-dropdown");

  if (userMenuButton && userMenu) {
    userMenuButton.addEventListener("click", (event) => {
      event.stopPropagation();
      const isOpen = userMenuButton.getAttribute("aria-expanded") === "true";
      userMenuButton.setAttribute("aria-expanded", (!isOpen).toString());
      userMenu.classList.toggle("hidden", isOpen);
    });

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
      iconOpen.classList.toggle("hidden", !isOpen); 
      iconClose.classList.toggle("hidden", isOpen);
    });
  }

  const notifButton = document.getElementById("notif-button");
  const notifMenu = document.getElementById("notif-menu");

    if (notifButton && notifMenu) {
      
      notifButton.addEventListener("click", (e) => {
        e.stopPropagation(); 
        const isVisible = !notifMenu.classList.contains("hidden");
        notifMenu.classList.toggle("hidden", isVisible);
      });
    }
});