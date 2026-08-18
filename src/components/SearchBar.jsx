import { Search, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

export default function SearchBar({ value, onChange }) {
  return (
    <div className="relative flex-1 min-w-[280px] max-w-md">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground pointer-events-none" />
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Localizar produto por nome ou código…"
        className="pl-10 pr-10 h-12 text-base font-medium border-primary/30 focus-visible:ring-primary"
      />
      {value && (
        <Button
          size="icon"
          variant="ghost"
          onClick={() => onChange('')}
          className="absolute right-1.5 top-1/2 -translate-y-1/2 h-8 w-8"
        >
          <X className="w-4 h-4" />
        </Button>
      )}
    </div>
  );
}