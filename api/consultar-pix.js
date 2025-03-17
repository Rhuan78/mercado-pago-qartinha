import axios from "axios";

export const config = {
  api: {
    bodyParser: true,
  },
};

export default async function handler(req, res) {
  // Adiciona suporte a CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  // Trata requisições OPTIONS (pré-flight)
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "GET") {
    return res.status(405).json({ error: "Método não permitido" });
  }

  const { paymentId } = req.query;

  if (!paymentId) {
    return res.status(400).json({ error: "ID do pagamento é obrigatório" });
  }

  try {
    const mercadoPagoResponse = await axios.get(
      `https://api.mercadopago.com/v1/payments/${paymentId}`,
      {
        headers: {
          Authorization: `Bearer ${process.env.MERCADO_PAGO_ACCESS_TOKEN}`,
        },
      }
    );

    return res.status(200).json(mercadoPagoResponse.data);
  } catch (error) {
    console.error("Erro ao consultar pagamento:", error.response ? error.response.data : error.message);
    return res.status(500).json({
      error: "Erro ao consultar pagamento",
      details: error.response ? error.response.data : error.message,
    });
  }
}
