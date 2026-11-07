// Copyright (c) 2025-2026 BEARTEC (Scott Reynolds). All rights reserved.
import { useState, useEffect, useCallback, useRef } from 'react';
import { Star, Search, ChevronDown, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { getFavorites, toggleFavorite, isFavorite, FALCON_TICKERS, isFalconTicker, type Ticker } from '@/lib/tickerUtils';

interface TickerSelectorProps {
  value: string;
  onChange: (value: string) => void;
  showSearch?: boolean;
}

export function TickerSelector({ value, onChange, showSearch = true }: TickerSelectorProps) {
  const [favorites, setFavorites] = useState<Ticker[]>([]);
  const [allTickers, setAllTickers] = useState<Ticker[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Ticker[]>([]);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [hasLoadedAll, setHasLoadedAll] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setFavorites(getFavorites());
  }, []);

  const loadAllTickers = useCallback(async () => {
    if (hasLoadedAll || isLoading) return;
    
    setIsLoading(true);
    try {
      const response = await fetch('/api/binance/exchange-info');
      let data: Ticker[] = [];
      if (response.ok) {
        data = await response.json();
      }
      // Falcon testnet markets are not on Binance — append explicitly.
      const merged = [...FALCON_TICKERS, ...data.filter((t: Ticker) => !isFalconTicker(t.value))];
      setAllTickers(merged);
      setHasLoadedAll(true);
    } catch (error) {
      console.error('Failed to load tickers:', error);
    } finally {
      setIsLoading(false);
    }
  }, [hasLoadedAll, isLoading]);

  useEffect(() => {
    if (isSearchOpen && !hasLoadedAll) {
      loadAllTickers();
    }
  }, [isSearchOpen, hasLoadedAll, loadAllTickers]);

  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }

    const query = searchQuery.toUpperCase();
    const filtered = allTickers.filter(t => 
      t.value.includes(query) || t.label.includes(query)
    ).slice(0, 50);
    
    setSearchResults(filtered);
  }, [searchQuery, allTickers]);

  const handleToggleFavorite = (ticker: Ticker, e: React.MouseEvent) => {
    e.stopPropagation();
    const result = toggleFavorite(ticker);
    setFavorites(result.favorites);
  };

  const handleSelectTicker = (tickerValue: string) => {
    onChange(tickerValue);
    setIsSearchOpen(false);
    setSearchQuery('');
  };

  const selectedLabel = favorites.find(f => f.value === value)?.label || 
                        allTickers.find(t => t.value === value)?.label || 
                        value.replace('USDT', '/USDT');

  return (
    <div className="flex items-center gap-2">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button 
            variant="outline" 
            className="bg-[#1e222d] border-[#2a2e39] text-white hover:bg-[#2a2e39] min-w-[120px] justify-between"
            data-testid="dropdown-favorites"
          >
            <span className="flex items-center gap-2">
              <Star className="w-3 h-3 text-yellow-400 fill-yellow-400" />
              {selectedLabel}
            </span>
            <ChevronDown className="w-4 h-4 ml-2 opacity-50" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="bg-[#1e222d] border-[#2a2e39] min-w-[150px]">
          {favorites.map(ticker => (
            <div
              key={ticker.value}
              className={`flex items-center justify-between px-2 py-1.5 text-white hover:bg-[#2a2e39] cursor-pointer ${ticker.value === value ? 'bg-[#2a2e39]' : ''}`}
              data-testid={`favorite-ticker-${ticker.value}`}
            >
              <span 
                onClick={() => handleSelectTicker(ticker.value)}
                className="flex-1"
              >
                {ticker.label}
              </span>
              <button
                onClick={(e) => handleToggleFavorite(ticker, e)}
                className="p-1 hover:bg-[#3a3e49] rounded ml-2"
                data-testid={`remove-favorite-${ticker.value}`}
              >
                <Star className="w-3 h-3 text-yellow-400 fill-yellow-400 hover:text-gray-400" />
              </button>
            </div>
          ))}
          {favorites.length === 0 && (
            <div className="text-gray-500 text-sm px-2 py-1">No favorites yet</div>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {showSearch && (
        <Popover open={isSearchOpen} onOpenChange={setIsSearchOpen}>
          <PopoverTrigger asChild>
            <Button 
              variant="outline"
              className="bg-[#1e222d] border-[#2a2e39] text-white hover:bg-[#2a2e39]"
              data-testid="button-search-tickers"
            >
              <Search className="w-4 h-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent 
            className="bg-[#1e222d] border-[#2a2e39] w-[280px] p-2"
            align="start"
          >
            <div className="space-y-2">
              <div className="relative">
                <Search className="absolute left-2 top-2.5 w-4 h-4 text-gray-500" />
                <Input
                  ref={searchInputRef}
                  placeholder="Search all pairs..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8 bg-[#0e0e0e] border-[#2a2e39] text-white"
                  autoFocus
                  data-testid="input-search-tickers"
                />
              </div>
              
              {isLoading && (
                <div className="flex items-center justify-center py-4 text-gray-400">
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Loading pairs...
                </div>
              )}

              {!isLoading && searchQuery && searchResults.length === 0 && (
                <div className="text-gray-500 text-sm py-2 text-center">
                  No matches found
                </div>
              )}

              {!isLoading && searchResults.length > 0 && (
                <ScrollArea className="h-[300px]">
                  <div className="space-y-1">
                    {searchResults.map(ticker => {
                      const isFav = isFavorite(ticker.value);
                      return (
                        <div
                          key={ticker.value}
                          className="flex items-center justify-between px-2 py-1.5 rounded hover:bg-[#2a2e39] cursor-pointer group"
                          onClick={() => handleSelectTicker(ticker.value)}
                          data-testid={`search-result-${ticker.value}`}
                        >
                          <span className="text-white text-sm">{ticker.label}</span>
                          <button
                            onClick={(e) => handleToggleFavorite(ticker, e)}
                            className="p-1 hover:bg-[#3a3e49] rounded"
                            data-testid={`star-${ticker.value}`}
                          >
                            <Star 
                              className={`w-4 h-4 transition-colors ${
                                isFav 
                                  ? 'text-yellow-400 fill-yellow-400' 
                                  : 'text-gray-500 hover:text-yellow-400'
                              }`}
                            />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </ScrollArea>
              )}

              {!isLoading && !searchQuery && (
                <div className="text-gray-500 text-sm py-2 text-center">
                  Type to search {allTickers.length > 0 ? `${allTickers.length} pairs` : '...'}
                </div>
              )}
            </div>
          </PopoverContent>
        </Popover>
      )}
    </div>
  );
}

export function FavoritesOnlySelector({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const [favorites, setFavorites] = useState<Ticker[]>([]);

  useEffect(() => {
    setFavorites(getFavorites());
    
    const handleStorage = () => setFavorites(getFavorites());
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  const selectedLabel = favorites.find(f => f.value === value)?.label || value.replace('USDT', '/USDT');

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button 
          variant="outline" 
          className="bg-[#1e222d] border-[#2a2e39] text-white hover:bg-[#2a2e39] min-w-[120px] justify-between"
          data-testid="dropdown-favorites-only"
        >
          <span>{selectedLabel}</span>
          <ChevronDown className="w-4 h-4 ml-2 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="bg-[#1e222d] border-[#2a2e39] min-w-[150px]">
        <div className="px-2 py-1 text-[10px] uppercase tracking-wide text-cyan-400/80">Falcon testnet</div>
        {FALCON_TICKERS.map(ticker => (
          <DropdownMenuItem
            key={`falcon-${ticker.value}`}
            onClick={() => onChange(ticker.value)}
            className={`text-white hover:bg-[#2a2e39] cursor-pointer ${ticker.value === value ? 'bg-[#2a2e39]' : ''}`}
            data-testid={`falcon-ticker-${ticker.value}`}
          >
            {ticker.label}
          </DropdownMenuItem>
        ))}
        <div className="px-2 py-1 text-[10px] uppercase tracking-wide text-gray-500">Binance</div>
        {favorites.map(ticker => (
          <DropdownMenuItem
            key={ticker.value}
            onClick={() => onChange(ticker.value)}
            className={`text-white hover:bg-[#2a2e39] cursor-pointer ${ticker.value === value ? 'bg-[#2a2e39]' : ''}`}
            data-testid={`favorite-only-${ticker.value}`}
          >
            {ticker.label}
          </DropdownMenuItem>
        ))}
        {favorites.length === 0 && (
          <div className="text-gray-500 text-sm px-2 py-1">Add favorites on Charts page</div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
