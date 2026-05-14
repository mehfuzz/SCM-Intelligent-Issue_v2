import { useParams, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { MOCK_BRDS, formatDateTime } from '../data/mockData';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Textarea } from '../components/ui/textarea';
import { Badge } from '../components/ui/badge';
import { toast } from 'sonner';
import { ArrowLeft, Check, FileText, History, X } from 'lucide-react';

export default function BrdEditor() {
  const { id = 'BRD-001' } = useParams();
  const navigate = useNavigate();
  const initial = MOCK_BRDS[id] || MOCK_BRDS['BRD-001'];
  const [brd, setBrd] = useState(initial);

  const updateSection = (key, val) => {
    setBrd((p) => ({ ...p, sections: { ...p.sections, [key]: val } }));
  };

  return (
    <div className="space-y-6" data-testid="brd-editor-page">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-mono-airtel text-xs text-gray-500">{brd.id}</span>
            <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100">{brd.status}</Badge>
            <Badge variant="secondary">{brd.version}</Badge>
          </div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-gray-900 mt-1">{brd.title}</h1>
          <p className="text-xs text-gray-500 mt-1">
            Linked to ticket{' '}
            <button onClick={() => navigate(`/tickets/${brd.ticketId}`)} className="text-red-600 font-mono-airtel hover:underline">
              {brd.ticketId}
            </button>
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" data-testid="brd-reject-btn" onClick={() => toast.message('Sent back for changes')}>
            <X className="h-4 w-4 mr-1" /> Request changes
          </Button>
          <Button data-testid="brd-approve-btn" className="bg-red-600 hover:bg-red-700" onClick={() => toast.success('BRD approved')}>
            <Check className="h-4 w-4 mr-1" /> Approve
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          {Object.entries(brd.sections).map(([key, val]) => (
            <Card key={key} className="border-gray-200 shadow-sm">
              <CardHeader className="border-b border-gray-100 py-3">
                <CardTitle className="font-display text-sm uppercase tracking-widest text-gray-700">{key}</CardTitle>
              </CardHeader>
              <CardContent className="p-4">
                <Textarea
                  data-testid={`brd-section-${key.replace(/\s+/g, '-').toLowerCase()}`}
                  value={val}
                  onChange={(e) => updateSection(key, e.target.value)}
                  rows={key === 'Functional Requirements' ? 6 : 3}
                  className="border-gray-200 focus-visible:ring-red-500"
                />
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="space-y-6">
          <Card className="border-gray-200 shadow-sm">
            <CardHeader className="border-b border-gray-100"><CardTitle className="font-display text-base flex items-center gap-2"><History className="h-4 w-4" /> Version history</CardTitle></CardHeader>
            <CardContent className="p-4">
              <ol className="space-y-3">
                {brd.versions.map((v) => (
                  <li key={v.v} className="flex items-start gap-2 text-xs">
                    <Badge variant="secondary" className="font-mono-airtel">{v.v}</Badge>
                    <div className="flex-1">
                      <div className="text-gray-700 font-medium">{v.by}</div>
                      <div className="text-gray-400">{formatDateTime(v.at)}</div>
                    </div>
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>

          <Card className="border-red-200 bg-red-50/40 shadow-sm">
            <CardContent className="p-4 flex items-start gap-3 text-xs">
              <FileText className="h-5 w-5 text-red-600 mt-0.5" />
              <div>
                <div className="font-semibold text-gray-900">AI draft</div>
                <div className="text-gray-600 mt-1">
                  This BRD was auto-drafted by the AI engine based on the linked ticket. Edit any section and approve when ready.
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
