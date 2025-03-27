/**
 * MediAssist Frontend Application
 * Connects the UI with API functionality
 */

// Wait for DOM to be fully loaded
document.addEventListener('DOMContentLoaded', () => {
  initApp();
});

/**
 * Initialize the application
 */
function initApp() {
  setupMobileMenu();
  setupDetailToggles();
  setupModalFunctions();
  setupFormSubmissions();
  setupFloatingElements();
  setupParallaxEffects();
  
  // Add ripple effect to buttons
  addRippleEffectToButtons();
}

/**
 * Setup mobile menu functionality
 */
function setupMobileMenu() {
  const mobileMenuToggle = document.getElementById('mobileMenuToggle');
  const mainNav = document.getElementById('mainNav');
  const overlay = document.getElementById('overlay');
  
  if (mobileMenuToggle && mainNav && overlay) {
    mobileMenuToggle.addEventListener('click', () => {
      mainNav.classList.toggle('active');
      overlay.classList.toggle('active');
    });
    
    overlay.addEventListener('click', () => {
      mainNav.classList.remove('active');
      overlay.classList.remove('active');
    });
  }
}

/**
 * Setup detail section toggles
 */
function setupDetailToggles() {
  const detailHeaders = document.querySelectorAll('.detail-header');
  
  detailHeaders.forEach(header => {
    header.addEventListener('click', () => {
      const detailItem = header.parentElement;
      detailItem.classList.toggle('active');
      
      // Add animation to the icon
      const icon = header.querySelector('.toggle-icon i');
      if (icon) {
        icon.style.transform = detailItem.classList.contains('active') 
          ? 'rotate(180deg)' 
          : 'rotate(0deg)';
      }
    });
  });
  
  // Setup animation on scroll for detail items
  const detailItems = document.querySelectorAll('.detail-item');
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('active');
        entry.target.style.animation = 'fadeInUp 0.5s ease-out forwards';
      }
    });
  }, { threshold: 0.1 });

  detailItems.forEach(item => {
    observer.observe(item);
  });
}

/**
 * Setup modal functionality
 */
function setupModalFunctions() {
  const demoButtons = document.querySelectorAll('.btn-secondary');
  const demoModal = document.getElementById('demoModal');
  const closeModal = document.getElementById('closeModal');
  const cancelDemo = document.getElementById('cancelDemo');
  
  if (demoModal && closeModal && cancelDemo) {
    demoButtons.forEach(button => {
      if (button.innerText.includes('Demo')) {
        button.addEventListener('click', () => {
          demoModal.classList.add('active');
        });
      }
    });
    
    closeModal.addEventListener('click', () => {
      demoModal.classList.remove('active');
    });
    
    cancelDemo.addEventListener('click', () => {
      demoModal.classList.remove('active');
    });
  }
}

/**
 * Setup form submissions
 */
function setupFormSubmissions() {
  // Contact form submission
  const contactForm = document.querySelector('#contact form');
  if (contactForm) {
    contactForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const name = document.getElementById('contact-name').value;
      const email = document.getElementById('contact-email').value;
      const phone = document.getElementById('contact-phone').value;
      const organization = document.getElementById('contact-organization').value;
      const message = document.getElementById('contact-message').value;
      
      try {
        const response = await MediAssistAPI.submitContactForm({
          name,
          email,
          phone,
          organization,
          message
        });
        
        alert(response.message || 'Thank you for your message!');
        contactForm.reset();
      } catch (error) {
        alert('Failed to submit form: ' + error.message);
      }
    });
  }
  
  // Demo form submission
  const demoForm = document.querySelector('#demoModal .modal-content');
  if (demoForm) {
    const submitButton = demoForm.querySelector('.btn-primary');
    
    submitButton.addEventListener('click', async () => {
      const name = document.getElementById('demo-name').value;
      const email = document.getElementById('demo-email').value;
      const phone = document.getElementById('demo-phone').value;
      const organization = document.getElementById('demo-organization').value;
      const date = document.getElementById('demo-date').value;
      const time = document.getElementById('demo-time').value;
      
      try {
        const response = await MediAssistAPI.scheduleDemo({
          name,
          email,
          phone,
          organization,
          date,
          time
        });
        
        alert(response.message || 'Demo scheduled successfully!');
        demoModal.classList.remove('active');
        demoForm.reset();
      } catch (error) {
        alert('Failed to schedule demo: ' + error.message);
      }
    });
  }
  
  // EHR Form submission for searching patients
  const ehrSearchForm = document.querySelector('#ehr .form-actions');
  if (ehrSearchForm) {
    const searchButton = ehrSearchForm.querySelector('.btn-primary');
    
    if (searchButton) {
      searchButton.addEventListener('click', async () => {
        const patientSearch = document.getElementById('patient-search')?.value || '';
        const recordType = document.getElementById('record-type')?.value || '';
        
        if (patientSearch.trim()) {
          try {
            // In a real app, this would do a filtered search
            const patients = await MediAssistAPI.getPatients();
            // Show results - simplified for this example
            console.log('Patient search results:', patients);
            alert(`Found ${patients.length} patients matching your search criteria.`);
          } catch (error) {
            alert('Error searching patients: ' + error.message);
          }
        } else {
          alert('Please enter a patient name or ID to search');
        }
      });
    }
  }
  
  // Prescription form
  const prescriptionForm = document.querySelector('.detail-content:has(#prescription-medication)');
  if (prescriptionForm) {
    const createButton = prescriptionForm.querySelector('.btn-primary');
    
    if (createButton) {
      createButton.addEventListener('click', async () => {
        const patientId = document.getElementById('prescription-patient')?.value;
        const medication = document.getElementById('prescription-medication')?.value;
        const dosage = document.getElementById('prescription-dosage')?.value;
        const frequency = document.getElementById('prescription-frequency')?.value;
        const notes = document.getElementById('prescription-notes')?.value;
        
        if (!patientId || !medication || !dosage || !frequency) {
          alert('Please fill in all required fields');
          return;
        }
        
        try {
          const prescription = await MediAssistAPI.createPrescription({
            patientId,
            medication,
            dosage,
            frequency,
            notes
          });
          
          alert(`Prescription ${prescription.id} created successfully!`);
        } catch (error) {
          alert('Error creating prescription: ' + error.message);
        }
      });
    }
  }
}

/**
 * Create floating elements animation
 */
function setupFloatingElements() {
  const container = document.body;
  const icons = [
    '✚', '💊', '🩺', '💉', '🧬', '🦠', '👨‍⚕️', '👩‍⚕️', '🧪'
  ];
  
  // Add keyframe animation for floating elements
  if (!document.querySelector('style#floating-animation')) {
    const style = document.createElement('style');
    style.id = 'floating-animation';
    style.textContent = `
      @keyframes float {
        0% {
          transform: translateY(0) rotate(0deg);
          opacity: 0;
        }
        10% {
          opacity: 0.1;
        }
        90% {
          opacity: 0.1;
        }
        100% {
          transform: translateY(-100vh) rotate(360deg);
          opacity: 0;
        }
      }
      
      .ripple {
        position: absolute;
        border-radius: 50%;
        background-color: rgba(255, 255, 255, 0.4);
        pointer-events: none;
        transform: scale(0);
        opacity: 1;
      }
    `;
    document.head.appendChild(style);
  }
  
  for (let i = 0; i < 15; i++) {
    setTimeout(() => {
      const floatingEl = document.createElement('div');
      floatingEl.classList.add('floating-icon');
      floatingEl.style.position = 'fixed';
      floatingEl.style.zIndex = '-1';
      floatingEl.style.opacity = '0.1';
      floatingEl.style.fontSize = `${20 + Math.random() * 20}px`;
      floatingEl.style.left = `${Math.random() * 100}vw`;
      floatingEl.style.top = '100vh';
      floatingEl.style.animation = `float ${15 + Math.random() * 10}s linear forwards`;
      floatingEl.textContent = icons[Math.floor(Math.random() * icons.length)];
      
      container.appendChild(floatingEl);
      
      // Remove after animation completes
      setTimeout(() => {
        floatingEl.remove();
      }, 25000);
    }, i * 2000);
  }
}

/**
 * Setup parallax effects
 */
function setupParallaxEffects() {
  document.addEventListener('mousemove', (e) => {
    const moveX = (e.clientX / window.innerWidth - 0.5) * 20;
    const moveY = (e.clientY / window.innerHeight - 0.5) * 20;
    
    document.querySelectorAll('.feature-icon').forEach(icon => {
      icon.style.transform = `translate(${moveX / 3}px, ${moveY / 3}px)`;
    });
    
    document.querySelectorAll('.hero h1').forEach(title => {
      title.style.textShadow = `${moveX / 10}px ${moveY / 10}px 4px rgba(0, 0, 0, 0.2)`;
    });
  });
}

/**
 * Add ripple effect to buttons
 */
function addRippleEffectToButtons() {
  const buttons = document.querySelectorAll('.btn');
  buttons.forEach(button => {
    button.addEventListener('click', function(e) {
      // Remove any existing ripples
      this.querySelectorAll('.ripple').forEach(r => r.remove());
      
      const ripple = document.createElement('span');
      ripple.classList.add('ripple');
      ripple.style.position = 'absolute';
      ripple.style.borderRadius = '50%';
      ripple.style.backgroundColor = 'rgba(255, 255, 255, 0.4)';
      ripple.style.pointerEvents = 'none';
      this.appendChild(ripple);

      const rect = button.getBoundingClientRect();
      const size = Math.max(rect.width, rect.height);
      const x = e.clientX - rect.left - size / 2;
      const y = e.clientY - rect.top - size / 2;

      ripple.style.width = ripple.style.height = `${size}px`;
      ripple.style.left = `${x}px`;
      ripple.style.top = `${y}px`;
      ripple.style.transform = 'scale(0)';
      ripple.style.transition = 'transform 0.6s, opacity 0.6s';
      
      setTimeout(() => {
        ripple.style.transform = 'scale(2)';
        ripple.style.opacity = '0';
        setTimeout(() => ripple.remove(), 600);
      }, 10);
    });
  });
} 