// Footer year
document.getElementById("year").textContent = new Date().getFullYear();

// Works list: floating image preview that follows the cursor
const preview = document.getElementById("work-preview");
const previewImg = preview.querySelector("img");
const fine = window.matchMedia("(hover: hover) and (pointer: fine)").matches;

if (fine) {
  let raf = null;
  let x = 0, y = 0;

  const move = () => {
    preview.style.left = x + "px";
    preview.style.top = y + "px";
    raf = null;
  };

  document.querySelectorAll(".work-list a").forEach((link) => {
    link.addEventListener("mouseenter", () => {
      const src = link.dataset.img;
      if (src && previewImg.getAttribute("src") !== src) previewImg.src = src;
      preview.classList.add("on");
    });
    link.addEventListener("mouseleave", () => preview.classList.remove("on"));
    link.addEventListener("mousemove", (e) => {
      x = e.clientX;
      y = e.clientY;
      if (!raf) raf = requestAnimationFrame(move);
    });
  });
}
