/**
 * MediAssist API Client
 * Handles communication with the backend API
 */

const MediAssistAPI = {
  /**
   * Get all patients
   * @returns {Promise} Promise resolving to patient data
   */
  getPatients: async function() {
    try {
      const response = await fetch('/api/patients');
      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.message || 'Failed to fetch patients');
      }
      
      return data.data;
    } catch (error) {
      console.error('Error fetching patients:', error);
      throw error;
    }
  },
  
  /**
   * Get a single patient by ID
   * @param {string} patientId - The patient's ID
   * @returns {Promise} Promise resolving to patient data
   */
  getPatient: async function(patientId) {
    try {
      const response = await fetch(`/api/patients/${patientId}`);
      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.message || 'Failed to fetch patient');
      }
      
      return data.data;
    } catch (error) {
      console.error(`Error fetching patient ${patientId}:`, error);
      throw error;
    }
  },
  
  /**
   * Create a new patient
   * @param {Object} patientData - The patient data
   * @returns {Promise} Promise resolving to created patient
   */
  createPatient: async function(patientData) {
    try {
      const response = await fetch('/api/patients', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(patientData)
      });
      
      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.message || 'Failed to create patient');
      }
      
      return data.data;
    } catch (error) {
      console.error('Error creating patient:', error);
      throw error;
    }
  },
  
  /**
   * Create a new prescription
   * @param {Object} prescriptionData - The prescription data
   * @returns {Promise} Promise resolving to created prescription
   */
  createPrescription: async function(prescriptionData) {
    try {
      const response = await fetch('/api/prescriptions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(prescriptionData)
      });
      
      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.message || 'Failed to create prescription');
      }
      
      return data.data;
    } catch (error) {
      console.error('Error creating prescription:', error);
      throw error;
    }
  },
  
  /**
   * Submit contact form
   * @param {Object} contactData - The contact form data
   * @returns {Promise} Promise resolving to submission confirmation
   */
  submitContactForm: async function(contactData) {
    try {
      const response = await fetch('/api/contact', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(contactData)
      });
      
      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.message || 'Failed to submit contact form');
      }
      
      return data;
    } catch (error) {
      console.error('Error submitting contact form:', error);
      throw error;
    }
  },
  
  /**
   * Schedule a demo
   * @param {Object} demoData - The demo scheduling data
   * @returns {Promise} Promise resolving to scheduled demo confirmation
   */
  scheduleDemo: async function(demoData) {
    try {
      const response = await fetch('/api/schedule-demo', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(demoData)
      });
      
      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.message || 'Failed to schedule demo');
      }
      
      return data;
    } catch (error) {
      console.error('Error scheduling demo:', error);
      throw error;
    }
  },
  
  /**
   * Upload a lab report
   * @param {Object} reportData - The lab report data
   * @returns {Promise} Promise resolving to uploaded report confirmation
   */
  uploadLabReport: async function(reportData) {
    try {
      // For a real implementation with file upload, you'd use FormData
      // const formData = new FormData();
      // Object.entries(reportData).forEach(([key, value]) => {
      //   formData.append(key, value);
      // });
      // if (reportData.file) {
      //   formData.append('reportFile', reportData.file);
      // }
      
      const response = await fetch('/api/lab-reports', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(reportData)
      });
      
      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.message || 'Failed to upload lab report');
      }
      
      return data;
    } catch (error) {
      console.error('Error uploading lab report:', error);
      throw error;
    }
  }
};

// Make available globally
window.MediAssistAPI = MediAssistAPI; 