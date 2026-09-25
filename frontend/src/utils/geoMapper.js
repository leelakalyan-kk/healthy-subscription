// Standardize Indian city aliases
export const normalizeCity = (cityStr = '') => {
  const c = cityStr.toLowerCase().trim();
  if (c.includes('bengaluru') || c.includes('bangalore')) return 'bangalore';
  if (c.includes('vijayawada') || c.includes('bezawada')) return 'vijayawada';
  if (c.includes('hyderabad') || c.includes('secunderabad')) return 'hyderabad';
  if (c.includes('visakhapatnam') || c.includes('vizag')) return 'visakhapatnam';
  if (c.includes('chennai') || c.includes('madras')) return 'chennai';
  if (c.includes('mumbai') || c.includes('bombay')) return 'mumbai';
  if (c.includes('delhi') || c.includes('ncr') || c.includes('noida') || c.includes('gurgaon')) return 'delhi';
  return c;
};

// Check if kitchen is deliverable to selected customer location
export const isDeliverable = (customerLocStr = '', item = {}) => {
  if (!customerLocStr || customerLocStr === '📍 Select Delivery Location') return true;

  const cleanCust = customerLocStr.toLowerCase();
  
  // 1. PIN Check
  const pinMatch = cleanCust.match(/\b\d{6}\b/);
  const customerPin = pinMatch ? pinMatch[0] : '';
  const kitchenPin = (item.pincode || '').trim();

  if (customerPin && kitchenPin && customerPin === kitchenPin) {
    return true;
  }

  // 2. City Normalization Check
  const normCustomerCity = normalizeCity(cleanCust);
  const normKitchenCity = normalizeCity(item.city || item.areaName || '');

  if (normCustomerCity && normKitchenCity && normCustomerCity === normKitchenCity) {
    return true;
  }

  return false;
};
