import '../../Style/pages/filter-panel.scss';

import React, { useEffect, useState, useRef } from 'react';
import type { FormEvent, ChangeEvent } from 'react';
import { Button } from '../ui/button';
import { Input } from '../../Components/ui/input';
import { getAvailableCategories } from '../../utils';
// Import icons for better UI
import {
  MapPin,
  X,
  ChevronsUpDown,
  Tag,
  DollarSign,
  Info,
  Package2,
  ListFilter,
  RefreshCcw
} from 'lucide-react';

export function FilterPanel({
  minPrice,
  setMinPrice,
  maxPrice,
  setMaxPrice,
  condition,
  setCondition,
  category,
  setCategory,
  maxDistance,
  setMaxDistance,
  onApply,
  onClose,
  onReset
}: {
  minPrice: string;
  setMinPrice: (v: string) => void;
  maxPrice: string;
  setMaxPrice: (v: string) => void;
  condition: string;
  setCondition: (v: string) => void;
  category: string;
  setCategory: (v: string) => void;
  maxDistance: number;
  setMaxDistance: (v: number) => void;
  onApply: () => void;
  onClose: () => void;
  onReset: () => void;
}) {
  const [categories, setCategories] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [useProximity, setUseProximity] = useState(maxDistance > 0);

  // Ref for the filter panel to detect outside clicks
  const filterPanelRef = useRef<HTMLDivElement>(null);

  // Add a ref for the slider
  const sliderRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const loadCategories = async () => {
      try {
        setIsLoading(true);
        const availableCategories = await getAvailableCategories();
        setCategories(availableCategories);
        setError(null);
      } catch (err) {
        setError('Failed to load categories');
        console.error('Error loading categories:', err);
      } finally {
        setIsLoading(false);
      }
    };

    loadCategories();
  }, []);

  // Handle outside clicks to close the filter panel
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        filterPanelRef.current &&
        !filterPanelRef.current.contains(event.target as Node)
      ) {
        onClose();
      }
    };

    // Add event listener
    document.addEventListener('mousedown', handleClickOutside);

    // Clean up
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [onClose]);

  // Handle proximity checkbox change
  const handleProximityChange = (e: ChangeEvent<HTMLInputElement>) => {
    const isChecked = e.target.checked;
    setUseProximity(isChecked);

    if (!isChecked) {
      setMaxDistance(0); // Reset distance when proximity is turned off
    } else if (maxDistance === 0) {
      // Set a default distance when turning on
      setMaxDistance(10);

      // Update the slider background immediately
      setTimeout(() => {
        if (sliderRef.current) {
          const min = parseInt(sliderRef.current.min);
          const max = parseInt(sliderRef.current.max);
          const percentage = ((10 - min) / (max - min)) * 100;
          sliderRef.current.style.background = `linear-gradient(to right, #00b37e 0%, #00b37e ${percentage}%, #e2e8f0 ${percentage}%, #e2e8f0 100%)`;
        }
      }, 0);
    }
  };

  // Update slider background when component mounts or when distance/proximity changes
  useEffect(() => {
    if (sliderRef.current && useProximity) {
      // Calculate the percentage of the slider value
      const min = parseInt(sliderRef.current.min || '1');
      const max = parseInt(sliderRef.current.max || '50');
      const value = maxDistance;
      const percentage = ((value - min) / (max - min)) * 100;

      // Update the background gradient
      sliderRef.current.style.background = `linear-gradient(to right, #00b37e 0%, #00b37e ${percentage}%, #e2e8f0 ${percentage}%, #e2e8f0 100%)`;
    }
  }, [maxDistance, useProximity]);

  return (
    <div className="filter-panel" ref={filterPanelRef}>
      <div className="filter-panel-header">
        <h3>
          <ListFilter size={18} /> Filters
        </h3>
        <button
          className="close-filter-btn"
          onClick={onClose}
          aria-label="Close filter panel"
        >
          <X size={18} />
        </button>
      </div>

      <form
        onSubmit={(e: FormEvent) => {
          e.preventDefault();
          onApply();
        }}
      >
        <div className="filter-sections">
          {/* Price Range Section */}
          <div className="filter-section">
            <div className="section-header">
              <DollarSign size={16} />
              <h4>Price Range</h4>
            </div>
            <div className="price-inputs">
              <div className="input-group">
                <label htmlFor="min-price">Minimum</label>
                <div className="input-with-icon">
                  <span className="input-icon">€</span>
                  <Input
                    id="min-price"
                    type="number"
                    min="0"
                    value={minPrice}
                    onChange={(e: ChangeEvent<HTMLInputElement>) =>
                      setMinPrice(e.target.value)
                    }
                    placeholder="e.g. 100"
                    className="price-input"
                  />
                </div>
              </div>
              <div className="input-group">
                <label htmlFor="max-price">Maximum</label>
                <div className="input-with-icon">
                  <span className="input-icon">€</span>
                  <Input
                    id="max-price"
                    type="number"
                    min="0"
                    value={maxPrice}
                    onChange={(e: ChangeEvent<HTMLInputElement>) =>
                      setMaxPrice(e.target.value)
                    }
                    placeholder="e.g. 500"
                    className="price-input"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Condition Section */}
          <div className="filter-section">
            <div className="section-header">
              <Tag size={16} />
              <h4>Condition</h4>
            </div>
            <div className="select-wrapper">
              <select
                id="condition"
                value={condition}
                onChange={(e: ChangeEvent<HTMLSelectElement>) =>
                  setCondition(e.target.value)
                }
                className="styled-select"
              >
                <option value="">Any Condition</option>
                <option value="New">New</option>
                <option value="Like New">Like New</option>
                <option value="Good">Good</option>
                <option value="Fair">Fair</option>
                <option value="Poor">Poor</option>
              </select>
              <ChevronsUpDown size={16} className="select-icon" />
            </div>
          </div>

          {/* Category Section */}
          <div className="filter-section">
            <div className="section-header">
              <Package2 size={16} />
              <h4>Category</h4>
            </div>
            <div className="select-wrapper">
              <select
                id="category"
                value={category}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                  setCategory(e.target.value)
                }
                disabled={isLoading}
                className="styled-select"
              >
                <option value="">Any Category</option>
                {!isLoading &&
                  !error &&
                  categories.map((categoryOption: string) => (
                    <option value={categoryOption} key={categoryOption}>
                      {categoryOption}
                    </option>
                  ))}
              </select>
              <ChevronsUpDown size={16} className="select-icon" />
            </div>
            {error && <p className="error-message">{error}</p>}
          </div>

          {/* Location Section */}
          <div className="filter-section location-section">
            <div className="section-header">
              <MapPin size={16} />
              <h4>Location</h4>
              <div className="tooltip-wrapper">
                <Info size={14} className="info-icon" />
                <span className="tooltip-text">
                  Search listings near your location
                </span>
              </div>
            </div>

            <label className="proximity-toggle">
              <input
                type="checkbox"
                checked={useProximity}
                onChange={handleProximityChange}
                className="proximity-checkbox"
              />
              <div className="toggle-slider">
                <div className="toggle-knob"></div>
              </div>
              <span>Search by distance</span>
            </label>

            {useProximity && (
              <div className="distance-slider-container">
                <div className="distance-value">
                  <span>{maxDistance} km</span>
                </div>

                <input
                  id="max-distance"
                  ref={sliderRef}
                  type="range"
                  min="1"
                  max="50"
                  value={maxDistance}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => {
                    const newValue = Number(e.target.value);
                    setMaxDistance(newValue);
                  }}
                  className="modern-range"
                />
                <div className="range-labels">
                  <span>1km</span>
                  <span>50km</span>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="button-group">
          <Button type="submit" className="apply-button">
            Apply Filters
          </Button>
          <Button
            type="button"
            variant="outline"
            className="reset-button"
            onClick={onReset}
          >
            <RefreshCcw size={14} />
            Reset
          </Button>
        </div>
      </form>
    </div>
  );
}
