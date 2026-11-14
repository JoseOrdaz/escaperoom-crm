/** Datos de cada local (sin dependencias: se puede usar en cliente y servidor) */
const norm = (t: string) => t.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
const FOBIA_ROOMS = ["piedra filosofal", "gulliver y los gigantes", "academia de houdini", "casa de los fantasmas"];
export const isFobiaRoom = (roomName = "") => FOBIA_ROOMS.some((r) => norm(roomName).includes(r));

export const VENUES = {
  fobia: {
    from: '"Fobia Escape Room" <valencia@fobiaescape.com>',
    brand: "Fobia Escape Rooms Valencia",
    team: "Equipo de Fobia Escape",
    roomLabel: "Sala",
    gradient: "linear-gradient(135deg,#3f51b5,#1a237e)",
    accent: "#3f51b5",
    contact: "📧 valencia@fobiaescape.com · 📞 +34 654 60 89 75",
    info: `
        <h3 style="margin-top:24px;">📍 Nuestra ubicación</h3>
        <p>Plaza del Portal Nuevo, 8, Ciutat Vella, 46003 Valencia</p>
        <p><a href="https://maps.google.com/?q=Plaza+del+Portal+Nuevo,+8,+46003+Valencia" style="color:#3f51b5;">Abrir ubicación en Google Maps</a></p>
        <p>En la zona no es fácil encontrar parking gratuito. Recomendamos venir con tiempo, usar transporte público o aparcar en el Parking La Torreta (a 3 minutos caminando):</p>
        <p><a href="https://maps.google.com/?q=Parking+La+Torreta+Valencia" style="color:#3f51b5;">Abrir Parking La Torreta en Google Maps</a></p>
        <p>Para esta experiencia recomendamos ropa y calzado cómodo.</p>`,
  },
  action: {
    from: '"Action Gates" <valencia@action-gates.com>',
    brand: "Action Gates Skill Room Valencia",
    team: "Equipo de Action Gates",
    roomLabel: "Misión",
    gradient: "linear-gradient(135deg,#00796b,#00a884)",
    accent: "#00a884",
    contact: "📧 valencia@action-gates.com · 📞 +34 692 502 258",
    info: `
        <h3 style="margin-top:24px;">📍 Nuestra ubicación</h3>
        <p>C/ dels Centelles, 58, L'Eixample, 46006 València, Valencia</p>
        <p><a href="https://maps.google.com/?q=Carrer+dels+Centelles+58,+Valencia" style="color:#00a884;">Abrir ubicación en Google Maps</a></p>
        <p>Recomendamos venir con tiempo o usar transporte público. Hay múltiples aparcamientos de pago cercanos.</p>
        <p>Para esta experiencia recomendamos ropa y calzado cómodo.</p>`,
  },
} as const;
