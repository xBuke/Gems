import { supabase } from '@/lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import MapView, { Callout, MapType, Marker } from 'react-native-maps';
import { SafeAreaView } from 'react-native-safe-area-context';

const MAP_TYPES: { type: MapType; label: string }[] = [
  { type: 'standard', label: 'Street' },
  { type: 'satellite', label: 'Satellite' },
  { type: 'hybrid', label: 'Hybrid' },
];

const INITIAL_REGION = {
  latitude: 44.5,
  longitude: 16.4,
  latitudeDelta: 2,
  longitudeDelta: 2,
};

const CATEGORY_COLORS: Record<string, string> = {
  Beach: '#185FA5',
  Graffiti: '#D85A30',
  Viewpoint: '#BA7517',
  Food: '#1D9E75',
  Skate: '#534AB7',
  Nature: '#27500A',
};

const getCategoryColor = (category: string) => CATEGORY_COLORS[category] ?? '#1D9E75';

export default function MapScreen() {
  const router = useRouter();
  const [mapTypeIndex, setMapTypeIndex] = useState(0);
  const [gems, setGems] = useState([]);

  useEffect(() => {
    Location.requestForegroundPermissionsAsync();
  }, []);

  useEffect(() => {
    const fetchGems = async () => {
      const { data, error } = await supabase
        .from('gems')
        .select('*')
        .eq('is_private', false);
      if (data) setGems(data);
    };
    fetchGems();
  }, []);

  const currentMapType = MAP_TYPES[mapTypeIndex];

  const cycleMapType = () => {
    setMapTypeIndex((prev) => (prev + 1) % MAP_TYPES.length);
  };

  return (
    <View style={styles.container}>
      <MapView
        style={styles.map}
        initialRegion={INITIAL_REGION}
        mapType={currentMapType.type}
        showsUserLocation
        showsMyLocationButton
        followsUserLocation>
        {gems.map((gem: { id: string; latitude: number; longitude: number; title: string; category: string }) => (
          <Marker
            key={gem.id}
            coordinate={{ latitude: gem.latitude, longitude: gem.longitude }}>
            <View
              style={[
                styles.marker,
                { backgroundColor: getCategoryColor(gem.category) },
              ]}>
              <Text style={styles.markerText}>{gem.category.charAt(0)}</Text>
            </View>
            <Callout onPress={() => router.push('/gem/' + gem.id)}>
              <View style={styles.callout}>
                <Text style={styles.calloutTitle}>{gem.title}</Text>
                <View style={styles.calloutBadge}>
                  <Text style={styles.calloutBadgeText}>{gem.category}</Text>
                </View>
                <Text style={styles.calloutLink}>View details</Text>
              </View>
            </Callout>
          </Marker>
        ))}
      </MapView>

      <TouchableOpacity style={styles.backButton} onPress={() => router.back()} activeOpacity={0.8}>
        <Ionicons name="arrow-back" size={24} color="#000000" />
      </TouchableOpacity>

      <SafeAreaView style={styles.controls} edges={['top']} pointerEvents="box-none">
        <TouchableOpacity style={styles.layerButton} onPress={cycleMapType} activeOpacity={0.8}>
          <Text style={styles.layerButtonText}>{currentMapType.label}</Text>
        </TouchableOpacity>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  map: {
    flex: 1,
  },
  controls: {
    position: 'absolute',
    top: 0,
    right: 0,
  },
  backButton: {
    position: 'absolute',
    top: 60,
    left: 16,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  layerButton: {
    position: 'absolute',
    top: 60,
    right: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 8,
  },
  layerButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  marker: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  markerText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  callout: {
    padding: 8,
    minWidth: 140,
  },
  calloutTitle: {
    fontWeight: '700',
    fontSize: 14,
    marginBottom: 6,
  },
  calloutBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#1D9E75',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginBottom: 6,
  },
  calloutBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '600',
  },
  calloutLink: {
    color: '#1D9E75',
    fontSize: 13,
    fontWeight: '600',
  },
});
