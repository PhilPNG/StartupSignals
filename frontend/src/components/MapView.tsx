import { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { sectorColor } from '../lib/colors';
import type { ScoredCompany } from '../types';

const TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;
const NJ_CENTER: [number, number] = [-74.5, 40.15];
const BRAND = '#0e5a3c';
const CLUSTER = '#16a39a';
/** Matches the CSS breakpoint where the profile becomes a drawer over the map's right edge. */
const DRAWER_QUERY = '(min-width: 820px) and (max-width: 1279px)';
const DRAWER_WIDTH = 440;

interface Props {
  companies: ScoredCompany[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  /** Changing this (e.g. the dataset) re-frames the map on the next data load. */
  fitKey?: string;
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
export function MapView({ companies, selectedId, onSelect, fitKey }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const onSelectRef = useRef(onSelect);
  const fittedRef = useRef(false);
  const selectedRef = useRef(selectedId);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    onSelectRef.current = onSelect;
  }, [onSelect]);

  useEffect(() => {
    if (!TOKEN || !containerRef.current) return;
    mapboxgl.accessToken = TOKEN;
    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: 'mapbox://styles/mapbox/outdoors-v12',
      center: NJ_CENTER,
      zoom: 7,
    });
    map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), 'bottom-right');
    mapRef.current = map;
    // Mapbox only listens for window resizes; the map card also resizes when the profile column opens or closes.
    const resizeObserver = new ResizeObserver(() => map.resize());
    resizeObserver.observe(containerRef.current);

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
          'circle-color': CLUSTER,
          'circle-radius': ['step', ['get', 'point_count'], 15, 10, 21, 50, 28],
          'circle-stroke-width': 3,
          'circle-stroke-color': '#ffffff',
        },
      });
      map.addLayer({
        id: 'cluster-count',
        type: 'symbol',
        source: 'companies',
        filter: ['has', 'point_count'],
        layout: {
          'text-field': ['get', 'point_count_abbreviated'],
          'text-font': ['DIN Pro Bold', 'Arial Unicode MS Bold'],
          'text-size': 14,
        },
        paint: { 'text-color': '#ffffff' },
      });
      map.addLayer({
        id: 'pins',
        type: 'circle',
        source: 'companies',
        filter: ['!', ['has', 'point_count']],
        paint: {
          'circle-color': ['get', 'color'],
          'circle-radius': ['interpolate', ['linear'], ['get', 'score'], 0, 6, 100, 16],
          'circle-stroke-width': 2.5,
          'circle-stroke-color': '#ffffff',
        },
      });
      map.addLayer({
        id: 'pin-selected',
        type: 'circle',
        source: 'companies',
        filter: ['==', ['get', 'id'], ''],
        paint: {
          'circle-color': 'rgba(0, 0, 0, 0)',
          'circle-radius': ['interpolate', ['linear'], ['get', 'score'], 0, 11, 100, 21],
          'circle-stroke-width': 3,
          'circle-stroke-color': BRAND,
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
      resizeObserver.disconnect();
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    selectedRef.current = selectedId;
  }, [selectedId]);

  useEffect(() => {
    fittedRef.current = false;
  }, [fitKey]);

  useEffect(() => {
    const map = mapRef.current;
    const source = map?.getSource('companies') as mapboxgl.GeoJSONSource | undefined;
    source?.setData(toGeoJson(companies));

    // Frame the startups once per dataset; later filtering shouldn't move the camera.
    // If a startup is already selected (e.g. "Show on map"), frame it instead of the whole set.
    if (map && source && companies.length > 0 && !fittedRef.current) {
      const selected = companies.find((c) => c.id === selectedRef.current);
      if (selected && selected.lat != null && selected.lng != null) {
        map.jumpTo({ center: [selected.lng, selected.lat], zoom: 12 });
      } else {
        const bounds = new mapboxgl.LngLatBounds();
        for (const c of companies) if (c.lat != null && c.lng != null) bounds.extend([c.lng, c.lat]);
        if (!bounds.isEmpty()) map.fitBounds(bounds, { padding: 60, maxZoom: 10, duration: 0 });
      }
      fittedRef.current = true;
    }
  }, [companies, loaded]);

  useEffect(() => {
    if (loaded) mapRef.current?.setFilter('pin-selected', ['==', ['get', 'id'], selectedId ?? '']);
  }, [selectedId, loaded]);

  useEffect(() => {
    const company = companies.find((c) => c.id === selectedId);
    if (!company || company.lat == null || company.lng == null) return;
    // Keep the pin clear of the profile drawer when it overlaps the map.
    const right = window.matchMedia(DRAWER_QUERY).matches ? DRAWER_WIDTH : 0;
    mapRef.current?.flyTo({
      center: [company.lng, company.lat],
      zoom: 12,
      padding: { top: 0, bottom: 0, left: 0, right },
    });
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
