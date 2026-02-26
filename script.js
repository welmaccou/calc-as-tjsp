document.addEventListener('DOMContentLoaded', () => {
    // Select all inputs and selects
    const inputs = document.querySelectorAll('input, select');
    
    // Add event listener to all inputs to recalculate on change
    inputs.forEach(input => {
        input.addEventListener('input', calculateSalary);
        input.addEventListener('change', calculateSalary);
    });

    // Initial calculation
    calculateSalary();
});

// Format numbers to BRL currency
const formatCurrency = (value) => {
    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL'
    }).format(value);
};

function calculateSalary() {
    // 1. Get input values
    const salarioBase = parseFloat(document.getElementById('salario-base').value) || 0;
    const taxaFormacao = parseFloat(document.getElementById('formacao-academica').value) || 0;
    const qtdQuinquenios = parseInt(document.getElementById('quinquenios').value) || 0;
    const dependentesIr = parseInt(document.getElementById('dependentes-ir').value) || 0;
    
    const diasTransporte = parseInt(document.getElementById('dias-transporte').value) || 0;
    const diasAlimentacao = parseInt(document.getElementById('dias-alimentacao').value) || 0;
    const baseSaude = parseFloat(document.getElementById('faixa-etaria-saude').value) || 0;
    const temSaudePcd = document.getElementById('saude-pcd').checked;
    
    // Check if SPPREV limit applies (Now hardcoded to true per user request)
    const temTetoSpprev = true;
    
    const crecheNormal = parseInt(document.getElementById('auxilio-creche').value) || 0;
    const crechePcd = parseInt(document.getElementById('auxilio-creche-pcd').value) || 0;

    // 2. Calculate Earnings (Proventos)
    // Adicional de Qualificação (Formação Acadêmica)
    const valorQualificacao = salarioBase * taxaFormacao;

    // A base de cálculo do Adicional de Tempo de Serviço (ATS) é a soma dos Vencimentos com o Adicional de Qualificação
    const baseATS = salarioBase + valorQualificacao;

    // Quinquênio: 5% da base ATS por quinquênio
    const valorQuinquenios = baseATS * 0.05 * qtdQuinquenios;
    
    // Sexta-parte: Se o servidor tiver 4 quinquênios (20 anos) ou mais (automático)
    let valorSextaParte = 0;
    if (qtdQuinquenios >= 4) {
        valorSextaParte = baseATS * 0.2;
    }

    const adicionaisTemporais = valorQuinquenios + valorSextaParte + valorQualificacao;
    const totalTributavel = salarioBase + adicionaisTemporais;
    
    // Indenizações
    const valorAlimentacao = diasAlimentacao * 80.00;
    const valorTransporte = diasTransporte * 14.00;
    
    let auxSaudeFinal = baseSaude;
    if (temSaudePcd) {
        auxSaudeFinal = baseSaude * 1.5; // Acréscimo de 50%
    }

    const valorCreche = (crecheNormal * 805.00) + (crechePcd * 1207.50);

    const totalIndenizacoes = valorAlimentacao + valorTransporte + auxSaudeFinal + valorCreche;
    const totalBrutoGeral = totalTributavel + totalIndenizacoes;

    // 3. Calculate Deductions (Descontos)
    
    // SPPREV - Contribuição Previdenciária SP (Progressiva)
    let descontoSpprev = 0;
    let baseSpprev = totalTributavel;

    const spprevFaixa1 = 1518.00;
    const spprevFaixa2 = 4022.46;
    const spprevFaixa3 = 8157.41;

    // Aplica o teto previdenciário caso selecionado (R$ 8.157,41)
    if (temTetoSpprev && baseSpprev > spprevFaixa3) {
        baseSpprev = spprevFaixa3;
    }

    if (baseSpprev > 0) {
        let fatia1 = Math.min(baseSpprev, spprevFaixa1);
        descontoSpprev += fatia1 * 0.11;
    }
    if (baseSpprev > spprevFaixa1) {
        let fatia2 = Math.min(baseSpprev - spprevFaixa1, spprevFaixa2 - spprevFaixa1);
        descontoSpprev += fatia2 * 0.12;
    }
    if (baseSpprev > spprevFaixa2) {
        let fatia3 = Math.min(baseSpprev - spprevFaixa2, spprevFaixa3 - spprevFaixa2);
        descontoSpprev += fatia3 * 0.14;
    }
    if (baseSpprev > spprevFaixa3) {
        let fatia4 = baseSpprev - spprevFaixa3;
        descontoSpprev += fatia4 * 0.16;
    }

    // Imposto de Renda (IRPF)
    const deducaoDependentes = dependentesIr * 189.59;
    
    let baseCalculoIrpf = totalTributavel - descontoSpprev - deducaoDependentes;
    if (baseCalculoIrpf < 0) baseCalculoIrpf = 0;

    let descontoIrpf = 0;

    // Isenção Total: Qualquer remuneração bruta até R$ 5.000,00 é totalmente isenta de imposto de renda
    if (totalTributavel > 5000.00) {
        // Enquadra a alíquota de acordo com a remuneração bruta (totalTributavel)
        if (totalTributavel <= 3036.00) {
            descontoIrpf = 0;
        } else if (totalTributavel <= 3533.31) {
            descontoIrpf = (baseCalculoIrpf * 0.075) - 182.16;
        } else if (totalTributavel <= 4688.85) {
            descontoIrpf = (baseCalculoIrpf * 0.15) - 394.16;
        } else if (totalTributavel <= 5830.85) {
            descontoIrpf = (baseCalculoIrpf * 0.225) - 675.49;
        } else {
            descontoIrpf = (baseCalculoIrpf * 0.275) - 908.73;
        }

        // Dedução Extra (Redução) para remunerações até 7.350,00
        if (totalTributavel <= 7350.00) {
            let reducaoExtra = 978.62 - (0.133145 * totalTributavel);
            if (reducaoExtra > 0) {
                descontoIrpf -= reducaoExtra;
            }
        }
    }

    if (descontoIrpf < 0) descontoIrpf = 0;

    const totalDescontos = descontoSpprev + descontoIrpf;

    // 4. Calculate Net Salary
    const salarioLiquido = totalBrutoGeral - totalDescontos;

    // 5. Update DOM
    document.getElementById('lbl-bruto').textContent = formatCurrency(salarioBase);
    document.getElementById('lbl-qualificacao').textContent = formatCurrency(valorQualificacao);
    document.getElementById('lbl-quinquenios').textContent = formatCurrency(valorQuinquenios);
    document.getElementById('lbl-sexta-parte').textContent = formatCurrency(valorSextaParte);
    document.getElementById('lbl-tributavel').textContent = formatCurrency(totalTributavel);

    document.getElementById('lbl-alimentacao').textContent = formatCurrency(valorAlimentacao);
    document.getElementById('lbl-transporte').textContent = formatCurrency(valorTransporte);
    document.getElementById('lbl-saude').textContent = formatCurrency(auxSaudeFinal);
    document.getElementById('lbl-creche').textContent = formatCurrency(valorCreche);
    
    document.getElementById('lbl-total-vencimentos').textContent = formatCurrency(totalBrutoGeral);

    document.getElementById('lbl-spprev').textContent = `- ${formatCurrency(descontoSpprev)}`;
    document.getElementById('lbl-irpf').textContent = `- ${formatCurrency(descontoIrpf)}`;
    document.getElementById('lbl-total-descontos').textContent = `- ${formatCurrency(totalDescontos)}`;

    document.getElementById('lbl-salario-liquido').textContent = formatCurrency(salarioLiquido);
}
