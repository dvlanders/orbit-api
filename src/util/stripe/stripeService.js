const supabase = require("../supabaseClient");
const { supabaseCall } = require("../supabaseWithRetry");

const insertProduct = async (productId, name) => {
  const { data, error } = await supabaseCall(() =>
    supabase
      .from("stripe_product_id")
      .insert({ product_id: productId, name: name })
  );

  if (error) throw error;
  return data;
};

const deleteProduct = async (productId) => {
  const { error } = await supabaseCall(() =>
    supabase.from("stripe_product_id").delete().eq("product_id", productId)
  );

  if (error) throw error;
};

const getProductId = async (name) => {
  const { data, error } = await supabaseCall(() =>
    supabase
      .from("stripe_product_id")
      .select("product_id")
      .eq("name", name)
      .single()
  );

  if (error) throw error;
  return data;
}

module.exports = {
  insertProduct,
  deleteProduct,
  getProductId
};
