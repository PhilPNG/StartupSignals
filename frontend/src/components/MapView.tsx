import { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { sectorColor } from '../lib/colors';
import type { ScoredCompany } from '../types';

const TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;
const NJ_CENTER: [number, number] = [-74.5, 40.15];

interface Props {
  companies: ScoredCompany[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

function toGeoJson(companies: ScoredCompany[]) {
  const hasCoordinates = (c: ScoredCompany): c is ScoredCompany & { lat: number; lng: number } =>
    c.lat != null && c.lng != null;
  return {
    type: 'FeatureCollection' as const,
    features: companies.filter(hasCoordinates).map((c) => ({
      type: 'Feature' as const,
      geometry: { type: 'Point' as const, coordinates: [c.lng, c.lat] },
      properties: { id: c.id, score: c.score, color: sectorColor(c.sector) },
    })),
  };
}

/** One pin per startup: color = sector, size = score; clustered when zoomed out. */
export function MapView({ companies, selectedId, onSelect }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const onSelectRef = useRef(onSelect);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    onSelectRef.current = onSelect;
  }, [onSelect]);

  useEffect(() => {
    if (!TOKEN || !containerRef.current) return;
    mapboxgl.accessToken = TOKEN;
    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: 'mapbox://styles/mapbox/light-v11',
      center: NJ_CENTER,
      zoom: 7,
    });
    mapRef.current = map;

    map.on('load', () => {
      map.addSource('companies', {
        type: 'geojson',
        data: toGeoJson([]),
        cluster: true,
        clusterMaxZoom: 11,
        clusterRadius: 40,
      });
      map.addLayer({
        id: 'clusters',
        type: 'circle',
        source: 'companies',
        filter: ['has', 'point_count'],
        paint: {
          'circle-color': '#475569',
          'circle-opacity': 0.85,
          'circle-radius': ['step', ['get', 'point_count'], 14, 10, 20, 50, 28],
        },
      });
      map.addLayer({
        id: 'cluster-count',
        type: 'symbol',
        source: 'companies',
        filter: ['has', 'point_count'],
        layout: { 'text-field': ['get', 'point_count_abbreviated'], 'text-size': 12 },
        paint: { 'text-color': '#ffffff' },
      });
      map.addLayer({
        id: 'pins',
        type: 'circle',
        source: 'companies',
        filter: ['!', ['has', 'point_count']],
        paint: {
          'circle-color': ['get', 'color'],
          'circle-radius': ['interpolate', ['linear'], ['get', 'score'], 0, 5, 100, 16],
          'circle-stroke-width': 1.5,
          'circle-stroke-color': '#ffffff',
        },
      });
      // TODO: optional heatmap layer for score density by county.

      map.on('click', 'pins', (e) => {
        const id = e.features?.[0]?.properties?.id;
        if (id) onSelectRef.current(String(id));
      });
      map.on('click', 'clusters', (e) => map.easeTo({ center: e.lngLat, zoom: map.getZoom() + 2 }));
      for (const layer of ['pins', 'clusters']) {
        map.on('mouseenter', layer, () => (map.getCanvas().style.cursor = 'pointer'));
        map.on('mouseleave', layer, () => (map.getCanvas().style.cursor = ''));
      }
      setLoaded(true);
    });

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const source = mapRef.current?.getSource('companies') as mapboxgl.GeoJSONSource | undefined;
    source?.setData(toGeoJson(companies));
  }, [companies, loaded]);

  useEffect(() => {
    const company = companies.find((c) => c.id === selectedId);
    if (company && company.lat != null && company.lng != null) {
      mapRef.current?.flyTo({ center: [company.lng, company.lat], zoom: 12 });
    }
    // Only fly when the selection changes, not when scores re-rank.
  }, [selectedId]);

  if (!TOKEN) {
    return (
      <div className="map map-placeholder">
        <p>
          Set <code>VITE_MAPBOX_TOKEN</code> in <code>frontend/.env.local</code> to show the map.
        </p>
      </div>
    );
  }
  return <div ref={containerRef} className="map" />;
}
