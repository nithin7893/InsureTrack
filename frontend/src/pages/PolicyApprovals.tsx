import { useState, useEffect } from 'react';
import { ClipboardCheck, Check, X, AlertTriangle, Phone } from 'lucide-react';
import { policyApprovalService } from '../services/api';
import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';
import { Toast } from '../components/ui/toast';
import { formatCurrency, formatDate } from '../utils';
import type { Policy } from '../types';

export function PolicyApprovalsPage() {
  const [pending, setPending] = useState<Policy[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const loadPending = async () => {
    try {
      const data = await policyApprovalService.getPendingApprovals();
      setPending(data);
      setError('');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load policy approval requests');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPending();
  }, []);

  const handleApprove = async (policy: Policy) => {
    setProcessingId(policy.id);
    try {
      await policyApprovalService.approvePolicy(policy.id);
      await loadPending();
      setToast({ message: `Policy ${policy.policy_number} approved and added to the policies list.`, type: 'success' });
    } catch (err: any) {
      setToast({ message: err.response?.data?.error || 'Failed to approve policy', type: 'error' });
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (policy: Policy) => {
    if (!confirm(`Reject and remove the policy request ${policy.policy_number}?`)) {
      return;
    }
    setProcessingId(policy.id);
    try {
      await policyApprovalService.rejectPolicy(policy.id);
      await loadPending();
      setToast({ message: `Policy ${policy.policy_number} was rejected and removed.`, type: 'success' });
    } catch (err: any) {
      setToast({ message: err.response?.data?.error || 'Failed to reject policy', type: 'error' });
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Policy Approvals</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Policies submitted by users who require central admin approval. Approving a request adds
          it to the policies list; rejecting it removes the request.
        </p>
      </div>

      {toast && (
        <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
      )}

      {error && (
        <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{error}</div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-12 text-muted-foreground">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      ) : pending.length === 0 ? (
        <Card className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <ClipboardCheck className="mb-4 h-12 w-12" />
          <p className="font-medium">No pending policy approvals</p>
          <p className="text-sm">New requests will appear here as notifications.</p>
        </Card>
      ) : (
        <>
          <Card className="border-amber-200 bg-amber-50 p-4">
            <div className="flex items-center gap-2 text-amber-800">
              <AlertTriangle className="h-5 w-5 text-amber-600" />
              <span className="font-semibold">
                {pending.length} policy request{pending.length === 1 ? '' : 's'} awaiting approval
              </span>
            </div>
          </Card>

          <div className="space-y-4">
            {pending.map(policy => (
              <Card key={policy.id} className="p-5">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-lg font-semibold">{policy.customer_name}</span>
                      <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-1 text-xs font-medium text-amber-700">
                        Pending approval
                      </span>
                      <span className="inline-flex items-center rounded-full bg-primary/10 px-2 py-1 text-xs font-medium text-primary">
                        {policy.insurance_type}
                      </span>
                    </div>

                    <div className="grid gap-x-8 gap-y-1 text-sm sm:grid-cols-2 lg:grid-cols-3">
                      <div><span className="text-muted-foreground">Policy No:</span> <span className="font-medium">{policy.policy_number}</span></div>
                      <div><span className="text-muted-foreground">Company:</span> {policy.company}</div>
                      <div><span className="text-muted-foreground">Product:</span> {policy.product}</div>
                      <div><span className="text-muted-foreground">Premium:</span> {formatCurrency(policy.total_premium)}</div>
                      <div className="flex items-center gap-1">
                        <Phone className="h-3 w-3 text-muted-foreground" />
                        {policy.primary_phone}
                      </div>
                      <div><span className="text-muted-foreground">Period:</span> {formatDate(policy.start_date)} - {formatDate(policy.end_date)}</div>
                      <div><span className="text-muted-foreground">Agent:</span> {policy.agent_name || '—'}</div>
                      <div><span className="text-muted-foreground">Location:</span> {policy.location || '—'}</div>
                      <div><span className="text-muted-foreground">Requested by:</span> {policy.requested_by_name || '—'}</div>
                    </div>

                    {policy.created_at && (
                      <p className="text-xs text-muted-foreground">
                        Submitted {formatDate(policy.created_at)}
                      </p>
                    )}
                  </div>

                  <div className="flex shrink-0 gap-2">
                    <Button
                      variant="outline"
                      className="border-green-300 text-green-700 hover:bg-green-50"
                      disabled={processingId === policy.id}
                      onClick={() => handleApprove(policy)}
                    >
                      <Check className="mr-1 h-4 w-4" />
                      Approve
                    </Button>
                    <Button
                      variant="outline"
                      className="border-red-300 text-red-700 hover:bg-red-50"
                      disabled={processingId === policy.id}
                      onClick={() => handleReject(policy)}
                    >
                      <X className="mr-1 h-4 w-4" />
                      Reject
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
