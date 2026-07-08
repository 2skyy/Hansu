const menuButton = document.getElementById('menuButton');
const nav = document.getElementById('nav');

menuButton.addEventListener('click', () => {
  nav.classList.toggle('open');
});

nav.querySelectorAll('a').forEach((link) => {
  link.addEventListener('click', () => {
    nav.classList.remove('open');
  });
});
