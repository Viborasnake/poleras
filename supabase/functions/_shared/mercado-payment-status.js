export function mercadoPaymentStatus(payment={}){
 const status=String(payment.status||'').toLowerCase();
 const amount=Number(payment.transaction_amount)||0;
 const refunded=Number(payment.transaction_amount_refunded)||0;
 if(status==='charged_back')return 'charged_back';
 if(status==='in_mediation')return 'in_mediation';
 if(status==='refunded'||refunded>0&&amount>0&&refunded>=amount)return 'refunded';
 if(refunded>0||String(payment.status_detail||'').toLowerCase()==='partially_refunded')return 'partially_refunded';
 if(status==='approved')return 'approved';
 if(status==='rejected')return 'rejected';
 if(status==='cancelled')return 'cancelled';
 return 'pending';
}
