// Mobile nav toggle + footer year
const toggle = document.getElementById("nav-toggle");
const links = document.getElementById("nav-links");

toggle.addEventListener("click", () => links.classList.toggle("open"));

// Close the menu after tapping a link (mobile)
links.addEventListener("click", (e) => {
  if (e.target.tagName === "A") links.classList.remove("open");
});

document.getElementById("year").textContent = new Date().getFullYear();
