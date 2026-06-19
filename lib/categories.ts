export const CATEGORIES = [
  {
    id: 'nature',
    name: 'Nature',
    icon: 'leaf',
    color: '#27500A',
    subcategories: ['Forest Trail', 'Lake', 'Waterfall', 'Cave', 'Beach', 'Secret Cove', 'Hot Spring', 'Canyon', 'National Park']
  },
  {
    id: 'views',
    name: 'Views',
    icon: 'eye',
    color: '#BA7517',
    subcategories: ['Sunrise Spot', 'Sunset Spot', 'Viewpoint', 'Rooftop View', 'Bench with a View', 'Photography Spot', 'Night Sky Spot']
  },
  {
    id: 'sport',
    name: 'Sport',
    icon: 'bicycle',
    color: '#185FA5',
    subcategories: ['Skate Park', 'Tennis Court', 'Basketball Court', 'Stadium', 'Surf Spot', 'Climbing Wall', 'Bike Trail', 'Swimming Spot', 'Yoga Spot']
  },
  {
    id: 'social',
    name: 'Social',
    icon: 'beer',
    color: '#D85A30',
    subcategories: ['Hidden Bar', 'Local Restaurant', 'Street Food', 'Coffee Spot', 'Good Drinking Spot', 'Night Out', 'Live Music']
  },
  {
    id: 'urban',
    name: 'Urban',
    icon: 'color-palette',
    color: '#534AB7',
    subcategories: ['Graffiti', 'Street Art', 'Historic Site', 'Abandoned Place', 'Local Market', 'Architecture']
  },
  {
    id: 'chill',
    name: 'Chill',
    icon: 'sunny',
    color: '#0F6E56',
    subcategories: ['Picnic Spot', 'Hidden Garden', 'Hammock Spot', 'Reading Nook', 'Peaceful Bench', 'Rooftop Chill']
  },
  {
    id: 'hidden',
    name: 'Hidden Gems',
    icon: 'diamond',
    color: '#FFD700',
    subcategories: ['Secret Passage', 'Underground Spot', 'Members Only', 'Local Secret', 'Off the Map'],
    premium: true
  }
]

export const TAGS = [
  'Dog Friendly', 'Free Entry', 'Parking Nearby', 'Wheelchair Accessible',
  'Best at Sunset', 'Best at Sunrise', 'Crowded on Weekends', 'Hidden from Tourists',
  'Instagrammable', 'Family Friendly', 'Romantic', 'Adventure', 'Swimming', 'Hiking'
]

export const FREE_CATEGORY_IDS = ['nature', 'views', 'sport', 'social', 'urban', 'chill']
export const PREMIUM_CATEGORY_IDS = ['hidden']
export const FREE_GEM_LIMIT = 5
