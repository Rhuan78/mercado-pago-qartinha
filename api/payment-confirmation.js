import axios from "axios";
import { createClient } from "@supabase/supabase-js";

export const config = {
  api: {
    bodyParser: true,
  },
};

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Método não permitido" });
  }

  const paymentId = req.body?.data?.id;
  const topic = req.body?.type;

  if (topic !== "payment" || !paymentId) {
    return res.status(400).json({ error: "Dados inválidos na notificação" });
  }

  try {
    const { data: payment } = await axios.get(
      `https://api.mercadopago.com/v1/payments/${paymentId}`,
      {
        headers: {
          Authorization: `Bearer ${process.env.MERCADO_PAGO_ACCESS_TOKEN}`,
        },
      }
    );

    const description = payment.description || "";
    const match = description.match(/subscription_id=([\w-]+)/);

    if (!match) {
      return res.status(400).json({ error: "subscription_id não encontrado na descrição" });
    }

    const subscriptionId = match[1];

    if (payment.status === "approved") {
      const { error } = await supabase
        .from("subscriptions")
        .update({ status: "active" })
        .eq("id", subscriptionId);

      if (error) {
        console.error("Erro ao ativar assinatura:", error);
        return res.status(500).json({ error: "Erro ao ativar assinatura" });
      }

      return res.status(200).json({ success: true });
    }

    if (["cancelled", "rejected", "expired"].includes(payment.status)) {
      const { error } = await supabase
        .from("subscriptions")
        .delete()
        .eq("id", subscriptionId);

      if (error) {
        console.error("Erro ao excluir assinatura:", error);
        return res.status(500).json({ error: "Erro ao excluir assinatura" });
      }

      return res.status(200).json({ deleted: true });
    }

    return res.status(200).json({ message: "Pagamento ainda não aprovado" });

  } catch (error) {
    console.error("Erro no webhook:", error.response?.data || error.message);
    return res.status(500).json({ error: "Erro interno ao processar webhook" });
  }
}
