window.addEventListener('scroll', function () {
    const image = document.querySelector('.image');
    let scrollTop = window.pageYOffset || document.documentElement.scrollTop;
    image.style.transform = `translateY(${scrollTop * 0.3}px)`;
});