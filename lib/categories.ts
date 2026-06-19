export const CATEGORIES = [
  {
    id: 'nature',
    name: 'Nature',
    icon: 'leaf',
    color: '#27500A',
    subcategories: ['Forest Trail', 'Lake', 'Waterfall', 'Cave', 'Beach', 'Secret Cove', 'Hot Spring', 'Canyon', 'National Park', 'River Spot', 'Wildflower Field', 'Tide Pool', 'Cliff Edge', 'Cenote/Sinkhole', 'Old Growth Forest']
  },
  {
    id: 'views',
    name: 'Views',
    icon: 'eye',
    color: '#BA7517',
    subcategories: ['Sunrise Spot', 'Sunset Spot', 'Viewpoint', 'Rooftop View', 'Bench with a View', 'Photography Spot', 'Night Sky Spot', 'Drone Spot', 'City Skyline', 'Panoramic Overlook', 'Reflection Spot']
  },
  {
    id: 'sport',
    name: 'Sport',
    icon: 'bicycle',
    color: '#185FA5',
    subcategories: ['Skate Park', 'Tennis Court', 'Basketball Court', 'Stadium', 'Surf Spot', 'Climbing Wall', 'Bike Trail', 'Swimming Spot', 'Yoga Spot', 'Bouldering Spot', 'Running Loop', 'Free Outdoor Gym', 'Kayak/Paddle Launch', 'Disc Golf']
  },
  {
    id: 'social',
    name: 'Social',
    icon: 'beer',
    color: '#D85A30',
    subcategories: ['Hidden Bar', 'Local Restaurant', 'Street Food', 'Coffee Spot', 'Good Drinking Spot', 'Night Out', 'Live Music', 'Local Market', 'Bakery', 'Wine/Tasting Spot', 'Late-Night Eats', 'Food Truck']
  },
  {
    id: 'urban',
    name: 'Urban',
    icon: 'color-palette',
    color: '#534AB7',
    subcategories: ['Graffiti', 'Street Art', 'Abandoned Place', 'Architecture', 'Hidden Courtyard', 'Alleyway', 'Mural Wall', 'Old Industrial Site', 'Bridge/Underpass']
  },
  {
    id: 'culture',
    name: 'Culture & History',
    icon: 'business',
    color: '#7F77DD',
    subcategories: ['Museum (small/indie)', 'Memorial', 'Religious Site', 'Historic Site', 'Old Town Corner', 'Local Legend Spot', 'Cemetery (historic)']
  },
  {
    id: 'chill',
    name: 'Chill',
    icon: 'sunny',
    color: '#0F6E56',
    subcategories: ['Picnic Spot', 'Hidden Garden', 'Hammock Spot', 'Reading Nook', 'Bench', 'Rooftop Chill', 'Quiet Courtyard', 'Shaded Spot', 'Library/Co-working Nook']
  },
  {
    id: 'couples',
    name: 'Couples',
    icon: 'heart',
    color: '#E8723D',
    subcategories: ['Date Spot', 'Romantic Viewpoint', 'Quiet Dinner Spot', 'Sunset for Two', 'Hidden Picnic Spot', 'Anniversary Worthy']
  },
  {
    id: 'pets',
    name: 'With Pets',
    icon: 'paw',
    color: '#C75A28',
    subcategories: ['Dog-Friendly Trail', 'Off-Leash Area', 'Pet-Friendly Café', 'Dog Beach']
  },
  {
    id: 'family',
    name: 'Family & Kids',
    icon: 'people',
    color: '#0F9488',
    subcategories: ['Playground', 'Kid-Friendly Beach', 'Easy Family Trail', 'Free Activity Spot']
  },
  {
    id: 'hidden',
    name: 'Hidden Gems',
    icon: 'diamond',
    color: '#FFD700',
    subcategories: ['Secret Passage', 'Underground Spot', 'Members Only', 'Local Secret', 'Off the Map', 'Locals-Only Spot', 'Forgotten Ruin', 'No-Signal Zone'],
    premium: true
  }
]

export const TAGS = [
  // Accessibility & logistics
  'Free Entry', 'Paid Entry', 'Parking Nearby', 'Wheelchair Accessible', 'Public Transport Access', 'Requires Hiking', 'Easy Access',
  // Timing & conditions
  'Best at Sunset', 'Best at Sunrise', 'Crowded on Weekends', 'Hidden from Tourists', 'Seasonal', 'Year-Round', 'Tide-Dependent',
  // Vibe & purpose
  'Instagrammable', 'Family Friendly', 'Romantic', 'Adventure', 'Solo-Friendly', 'Group-Friendly', 'Quiet/Peaceful',
  // Activities on site
  'Swimming', 'Hiking', 'Picnicking', 'Fishing', 'Camping Nearby', 'Snorkeling',
  // Practical info
  'No Cell Signal', 'Bring Cash', 'Dog Friendly', 'No Bathroom Nearby', 'Shade Available'
]

export const FREE_CATEGORY_IDS = ['nature', 'views', 'sport', 'social', 'urban', 'culture', 'chill', 'couples', 'pets', 'family']
export const PREMIUM_CATEGORY_IDS = ['hidden']
export const FREE_GEM_LIMIT = 5
