// frontend/src/utils/exportPDF.js
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { toast } from 'sonner'; // Usamos la librería segura ya instalada

export const exportarEstadisticasPDF = async (elementoId, titulo) => {
  const elemento = document.getElementById(elementoId);
  
  if (!elemento) {
    toast.error(`No se encontró la sección a exportar (${elementoId})`);
    return;
  }
  
  const toastId = toast.loading('📄 Generando documento PDF...');
  
  try {
    const canvas = await html2canvas(elemento, {
      scale: 2, // Mejor resolución para lectura
      backgroundColor: '#ffffff',
      useCORS: true // Permite imágenes externas seguras
    });
    
    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });
    
    const imgWidth = 190;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;
    
    pdf.setFontSize(16);
    pdf.text(titulo, 105, 15, { align: 'center' });
    
    const fechaActual = new Date().toLocaleDateString('es-AR');
    pdf.setFontSize(10);
    pdf.text(`Generado: ${fechaActual}`, 105, 22, { align: 'center' });
    
    pdf.addImage(imgData, 'PNG', 10, 30, imgWidth, imgHeight);
    
    const fechaArchivo = new Date().toISOString().split('T')[0].replace(/-/g, '_');
    pdf.save(`reporte_${fechaArchivo}.pdf`);
    
    toast.success('✅ PDF descargado correctamente', { id: toastId });
  } catch (error) {
    console.error('Error generando PDF:', error.message);
    toast.error('No se pudo generar el archivo PDF', { id: toastId });
  }
};