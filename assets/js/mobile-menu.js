document.addEventListener('DOMContentLoaded', () => {
  const menuToggle = document.querySelector('.mobile-menu-toggle');
  const navMenu = document.querySelector('.main-nav ul');
  
  if (menuToggle && navMenu) {
    menuToggle.addEventListener('click', () => {
      navMenu.classList.toggle('active');
      
      // Accessibility
      const expanded = navMenu.classList.contains('active');
      menuToggle.setAttribute('aria-expanded', expanded);
    });
    
    // Close menu when clicking outside
    document.addEventListener('click', (event) => {
      if (!event.target.closest('.mobile-menu-toggle') && 
          !event.target.closest('.main-nav') && 
          navMenu.classList.contains('active')) {
        navMenu.classList.remove('active');
        menuToggle.setAttribute('aria-expanded', 'false');
      }
    });
  }
});