// Add to assets/js/mobile-menu.js
document.addEventListener('DOMContentLoaded', () => {
    const menuToggle = document.querySelector('.mobile-menu-toggle');
    const mainNav = document.querySelector('.main-nav ul');
    
    menuToggle.addEventListener('click', () => {
      mainNav.classList.toggle('active');
    });
  });