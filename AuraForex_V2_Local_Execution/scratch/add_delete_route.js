const fs = require('fs');

let code = fs.readFileSync('../server.js', 'utf8');

const deleteRoute = `
app.delete("/api/admin/providers/:id", requireAuth, requireAdmin, async (req, res) => {
  const { id } = req.params;
  try {
    await prisma.provider.delete({ where: { id } });
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro ao eliminar provedor." });
  }
});
`;

// Check if it already exists
if (code.includes('app.delete("/api/admin/providers/:id"')) {
    console.log('Route already exists');
} else {
    // Insert after the provider/apply route
    code = code.replace(
        'app.post("/api/user/provider/apply"',
        deleteRoute + '\napp.post("/api/user/provider/apply"'
    );
    fs.writeFileSync('../server.js', code);
    console.log('DELETE /api/admin/providers/:id route added!');
}
