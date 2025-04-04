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

  const { data, type } = req.body;
  const id = data?.id;
  const topic = type;

  if (topic !== "payment" || !id) {
    return res.status(400).json({ error: "Webhook inválido" });
  }

  try {
    const { data: payment } = await axios.get(
      `https://api.mercadopago.com/v1/payments/${id}`,
      {
        headers: {
          Authorization: `Bearer ${process.env.MERCADO_PAGO_ACCESS_TOKEN}`,
        },
      }
    );

    const description = payment.description || "";
    const match = description.match(/subscription_id=([\w-]+)/);

    if (!match) {
      console.warn("⚠️ subscription_id não encontrado na descrição:", description);
      return res.status(400).json({ error: "subscription_id não encontrado na descrição" });
    }

    const subscriptionId = match[1];
    console.log("🔍 subscription_id extraído:", subscriptionId);

    if (payment.status === "approved") {
  const { data: updatedData, error } = await supabase
    .from("subscriptions")
    .update({ status: "active" })
    .eq("subscription_id", subscriptionId)
    .select(); // remove o .single()

  if (error) {
    console.error("❌ Erro ao ativar assinatura:", error);
    return res.status(500).json({ error: "Erro ao ativar assinatura" });
  }

  if (!updatedData || updatedData.length === 0) {
    console.warn("⚠️ Nenhuma linha foi atualizada. Verifique se o ID existe:", subscriptionId);
    return res.status(200).json({ warning: "Nenhuma linha atualizada. ID pode não existir." });
  }

  console.log("✅ Assinatura ativada com sucesso:", updatedData[0]);
  return res.status(200).json({ success: true });
}


    if (["cancelled", "rejected", "expired"].includes(payment.status)) {
      const { error } = await supabase
        .from("subscriptions")
        .delete()
        .eq("subscription_id", subscriptionId);

      if (error) {
        console.error("❌ Erro ao excluir assinatura:", error);
        return res.status(500).json({ error: "Erro ao excluir assinatura" });
      }

      console.log("🗑️ Assinatura excluída (pagamento cancelado):", subscriptionId);
      return res.status(200).json({ deleted: true });
    }

    console.log("ℹ️ Pagamento ainda não aprovado:", payment.status);
    return res.status(200).json({ message: "Pagamento ainda não aprovado" });

  } catch (error) {
    if (error.response?.status === 404) {
      console.warn("⚠️ Pagamento não encontrado. Pode ser simulação/teste.");
      return res.status(200).json({ ignored: true });
    }

    console.error("🚨 Erro no webhook:", error.response?.data || error.message);
    return res.status(500).json({ error: "Erro interno ao processar webhook" });
  }
}
