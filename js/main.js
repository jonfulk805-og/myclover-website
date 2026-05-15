/* =============================================================================
   MyClover.Tech — Main JavaScript — Version X.01
   ============================================================================= */

// --- Navigation ---
const nav = document.getElementById('nav');
const mobileToggle = document.getElementById('mobileToggle');
const navLinks = document.getElementById('navLinks');

// Scroll effect
window.addEventListener('scroll', () => {
    nav.classList.toggle('scrolled', window.scrollY > 40);
});

// Mobile menu
if (mobileToggle) {
    mobileToggle.addEventListener('click', () => {
        navLinks.classList.toggle('open');
        mobileToggle.textContent = navLinks.classList.contains('open') ? '\u2715' : '\u2630';
    });
}

// Close mobile menu on link click
document.querySelectorAll('.nav-links a').forEach(link => {
    link.addEventListener('click', () => {
        navLinks.classList.remove('open');
        if (mobileToggle) mobileToggle.textContent = '\u2630';
    });
});

// --- Dropdown menu ---
const navDropdown = document.getElementById('navDropdown');
if (navDropdown) {
    const dropdownBtn = navDropdown.querySelector('.nav-dropdown-btn');
    let closeTimer = null;

    // Desktop: hover
    navDropdown.addEventListener('mouseenter', () => {
        if (window.innerWidth > 768) {
            clearTimeout(closeTimer);
            navDropdown.classList.add('open');
            dropdownBtn.setAttribute('aria-expanded', 'true');
        }
    });
    navDropdown.addEventListener('mouseleave', () => {
        if (window.innerWidth > 768) {
            closeTimer = setTimeout(() => {
                navDropdown.classList.remove('open');
                dropdownBtn.setAttribute('aria-expanded', 'false');
            }, 150);
        }
    });

    // Desktop + Mobile: click
    dropdownBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const isOpen = navDropdown.classList.contains('open');
        navDropdown.classList.toggle('open', !isOpen);
        dropdownBtn.setAttribute('aria-expanded', String(!isOpen));
    });

    // Close on outside click (desktop)
    document.addEventListener('click', (e) => {
        if (window.innerWidth > 768 && !navDropdown.contains(e.target)) {
            navDropdown.classList.remove('open');
            dropdownBtn.setAttribute('aria-expanded', 'false');
        }
    });

    // Close dropdown links on click
    navDropdown.querySelectorAll('.nav-dropdown-menu a').forEach(link => {
        link.addEventListener('click', () => {
            navDropdown.classList.remove('open');
            dropdownBtn.setAttribute('aria-expanded', 'false');
            navLinks.classList.remove('open');
            if (mobileToggle) mobileToggle.textContent = '\u2630';
        });
    });
}

// --- Smooth scroll for anchor links ---
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        const target = document.querySelector(this.getAttribute('href'));
        if (target) {
            e.preventDefault();
            target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    });
});

// --- Intersection Observer for scroll-in animations ---
const observerOptions = { threshold: 0.1, rootMargin: '0px 0px -40px 0px' };
const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.style.opacity = '1';
            entry.target.style.transform = 'translateY(0)';
            observer.unobserve(entry.target);
        }
    });
}, observerOptions);

// Animate cards on scroll
document.querySelectorAll('.product-card, .feature-card, .hw-card, .price-card, .acc-card, .credit-card').forEach(el => {
    el.style.opacity = '0';
    el.style.transform = 'translateY(24px)';
    el.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
    observer.observe(el);
});

// --- Stats counter animation ---
const statNumbers = document.querySelectorAll('.stat-number');
const statsObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.classList.add('counted');
            statsObserver.unobserve(entry.target);
        }
    });
}, { threshold: 0.5 });
statNumbers.forEach(el => statsObserver.observe(el));

// --- Active nav link highlighting ---
const sections = document.querySelectorAll('section[id]');
window.addEventListener('scroll', () => {
    let current = '';
    sections.forEach(section => {
        const sectionTop = section.offsetTop - 120;
        if (window.scrollY >= sectionTop) {
            current = section.getAttribute('id');
        }
    });
    document.querySelectorAll('.nav-links a').forEach(link => {
        link.style.color = '';
        if (link.getAttribute('href') === `#${current}`) {
            link.style.color = '#22c55e';
        }
    });
});

console.log('🍀 MyClover.Tech — Version X.01 — https://myclover.tech');
