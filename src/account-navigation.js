const clean=value=>String(value||'').trim().replace(/\s+/g,' ');

export function accountFromUser(user){
  if(!user||user.is_anonymous)return null;
  const metadata=user.user_metadata||{};
  const name=clean(metadata.full_name)||clean(user.email?.split('@')[0])||'Creativa';
  const givenName=clean(metadata.given_name)||clean(metadata.first_name)||name.split(' ')[0];
  return {id:user.id,name,givenName,email:user.email||''};
}

export function accountNavigationState(account){
  if(!account)return {authenticated:false,label:'Crear cuenta o iniciar sesión',ariaLabel:'Crear cuenta o iniciar sesión'};
  const label=clean(account.givenName)||clean(account.name).split(' ')[0]||'Mi cuenta';
  return {authenticated:true,label,ariaLabel:`Abrir cuenta de ${label}`};
}
