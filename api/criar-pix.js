import axios from "axios";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Método não permitido" });
  }

  try {
    const body = await req.json(); // ⬅️ Solução para o erro de req.body undefined
    const { amount, description, email, cpf } = body;

    if (!amount || !email || !cpf) {
      return res.status(400).json({ error: "Dados incompletos" });
    }

    const mercadoPagoResponse = await axios.post(
      "https://api.mercadopago.com/v1/payments",
      {
        transaction_amount: amount,
        description,
        payment_method_id: "pix",
        payer: {
          email,
          identification: {
            type: "CPF",
            number: cpf,
          },
        },
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.MERCADO_PAGO_ACCESS_TOKEN}`,
          "Content-Type": "application/json",
        },
      }
    );

    return res.status(200).json(mercadoPagoResponse.data);
  } catch (error) {
    console.error("Erro ao gerar PIX:", error.response ? error.response.data : error.message);
    return res.status(500).json({
      error: "Erro ao gerar pagamento PIX",
      details: error.response ? error.response.data : error.message,
    });
  }
}
