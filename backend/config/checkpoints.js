/**
 * Coordenadas geográficas de cada checkpoint.
 * O scan só é aceito se o GPS do usuário estiver dentro do `radiusMeters`.
 *
 * Para pegar coordenadas: abra o Google Maps, toque e segure no local,
 * copie o "compartilhar" e me passe — eu extraio o lat/lng.
 *
 * radiusMeters: margem de tolerância. GPS de celular tem ~10-30m de erro,
 * então valores abaixo de 50m podem frustrar usuários legítimos.
 */

module.exports = {
  // Ative o geofencing por checkpoint. Se enabled=false, aceita de qualquer lugar.
  1: { enabled: true,  lat: -23.5443563, lng: -46.6608366, radiusMeters: 120 },
  2: { enabled: false, lat: null,        lng: null,        radiusMeters: 120 },
  3: { enabled: false, lat: null,        lng: null,        radiusMeters: 120 },
  4: { enabled: false, lat: null,        lng: null,        radiusMeters: 120 },
};
