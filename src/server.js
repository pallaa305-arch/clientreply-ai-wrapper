import express from "express";
const app=express();
app.use(express.json());
app.get("/health",(_,res)=>res.json({ok:true}));
app.post("/api/generate",(req,res)=>res.json({success:true,echo:req.body}));
app.listen(process.env.PORT||8787,()=>console.log("running"));
