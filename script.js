document.addEventListener('DOMContentLoaded', () => {
    // Select all inputs and selects
    const inputs = document.querySelectorAll('input, select');
    
    // Add event listener to all inputs to recalculate on change
    inputs.forEach(input => {
        input.addEventListener('input', calculateSalary);
        input.addEventListener('change', calculateSalary);
    });

    // Initialize custom selects
    initCustomSelects();

    // Initial calculation
    calculateSalary();
});

// Custom Select Implementation
function initCustomSelects() {
    const selects = document.querySelectorAll('select:not(.custom-select)');
    
    selects.forEach(select => {
        const wrapper = document.createElement('div');
        wrapper.className = 'custom-select-wrapper';
        
        const customSelect = document.createElement('div');
        customSelect.className = 'custom-select';
        
        const trigger = document.createElement('div');
        trigger.className = 'custom-select-trigger';
        
        const selectedOptionText = select.options[select.selectedIndex].text;
        trigger.innerHTML = `<span>${selectedOptionText}</span><div class="arrow"></div>`;
        
        const optionsContainer = document.createElement('div');
        optionsContainer.className = 'custom-options';
        
        Array.from(select.options).forEach((option, index) => {
            const customOption = document.createElement('span');
            customOption.className = 'custom-option' + (index === select.selectedIndex ? ' selected' : '');
            customOption.textContent = option.textContent;
            customOption.setAttribute('data-value', option.value);
            
            customOption.addEventListener('click', () => {
                // Update native select
                select.value = option.value;
                
                // Update UI of custom select
                trigger.querySelector('span').textContent = option.textContent;
                optionsContainer.querySelectorAll('.custom-option').forEach(opt => opt.classList.remove('selected'));
                customOption.classList.add('selected');
                
                // Trigger change event on native select for calculation
                select.dispatchEvent(new Event('change'));
                
                // Close dropdown
                wrapper.classList.remove('open');
            });
            
            optionsContainer.appendChild(customOption);
        });
        
        trigger.addEventListener('click', (e) => {
            e.stopPropagation();
            // Close other open selects
            document.querySelectorAll('.custom-select-wrapper').forEach(openWrapper => {
                if (openWrapper !== wrapper) openWrapper.classList.remove('open');
            });
            wrapper.classList.toggle('open');
        });
        
        customSelect.appendChild(trigger);
        customSelect.appendChild(optionsContainer);
        wrapper.appendChild(customSelect);
        
        // Hide native select and insert custom one
        select.classList.add('hidden-select');
        select.parentNode.insertBefore(wrapper, select.nextSibling);
    });
    
    // Close dropdowns when clicking outside
    document.addEventListener('click', () => {
        document.querySelectorAll('.custom-select-wrapper').forEach(wrapper => {
            wrapper.classList.remove('open');
        });
    });
}

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
    // const temTetoSpprev = true; // Removed as it's handled within the spprev calculation function
    
    const crecheNormal = parseInt(document.getElementById('auxilio-creche').value) || 0;
    const crechePcd = parseInt(document.getElementById('auxilio-creche-pcd').value) || 0;

    // 2. Calculate Earnings (Proventos)
    const temFerias = document.getElementById('adicional-ferias').checked;
    const tipo13 = parseInt(document.getElementById('parcela-13').value) || 0;

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
    const totalTributavelNormal = salarioBase + adicionaisTemporais;
    
    // Férias (Adicional de 1/3)
    let valorFerias = 0;
    if (temFerias) {
        valorFerias = totalTributavelNormal / 3;
    }
    const totalTributavelComFerias = totalTributavelNormal + valorFerias;

    // Indenizações
    const valorAlimentacao = diasAlimentacao * 80.00;
    const valorTransporte = diasTransporte * 14.00;
    
    let auxSaudeFinal = baseSaude;
    if (temSaudePcd) {
        auxSaudeFinal = baseSaude * 1.5; // Acréscimo de 50%
    }

    const valorCrecheNormal = crecheNormal * 805.00;
    const valorCrechePcd = crechePcd * 1207.50;

    const totalIndenizacoes = valorAlimentacao + valorTransporte + auxSaudeFinal + valorCrecheNormal + valorCrechePcd;
    
    // 13º Salário
    let valor13_1 = 0;
    let valor13_2 = 0;
    let descontoSpprev13 = 0;
    let descontoIrpf13 = 0;

    const base13 = totalTributavelNormal; 

    if (tipo13 === 1) {
        valor13_1 = base13 * 0.5;
    } else if (tipo13 === 2) {
        valor13_2 = base13 * 0.5; 
        descontoSpprev13 = calcularDescontoSpprev(base13);
        descontoIrpf13 = calcularDescontoIrpf(base13, descontoSpprev13, dependentesIr);
    }

    const totalBrutoGeral = totalTributavelComFerias + totalIndenizacoes + valor13_1 + valor13_2;

    // 3. Calculate Deductions (Descontos)
    const descontoSpprev = calcularDescontoSpprev(totalTributavelComFerias);
    const descontoIrpf = calcularDescontoIrpf(totalTributavelComFerias, descontoSpprev, dependentesIr);

    const totalDescontos = descontoSpprev + descontoIrpf + descontoSpprev13 + descontoIrpf13;

    // 4. Calculate Net Salary
    const salarioLiquido = totalBrutoGeral - totalDescontos;

    // 5. Update DOM
    document.getElementById('lbl-bruto').textContent = formatCurrency(salarioBase);
    document.getElementById('lbl-qualificacao').textContent = formatCurrency(valorQualificacao);
    document.getElementById('lbl-quinquenios').textContent = formatCurrency(valorQuinquenios);
    document.getElementById('lbl-sexta-parte').textContent = formatCurrency(valorSextaParte);
    
    const rowFerias = document.getElementById('row-ferias');
    if (temFerias) {
        rowFerias.style.display = 'flex';
        document.getElementById('lbl-ferias').textContent = formatCurrency(valorFerias);
    } else {
        rowFerias.style.display = 'none';
    }

    document.getElementById('lbl-tributavel').textContent = formatCurrency(totalTributavelComFerias);

    document.getElementById('lbl-alimentacao').textContent = formatCurrency(valorAlimentacao);
    document.getElementById('lbl-transporte').textContent = formatCurrency(valorTransporte);
    document.getElementById('lbl-saude').textContent = formatCurrency(auxSaudeFinal);
    const rowCreche = document.getElementById('row-creche');
    if (valorCrecheNormal > 0) {
        rowCreche.style.display = 'flex';
        document.getElementById('lbl-creche').textContent = formatCurrency(valorCrecheNormal);
    } else {
        rowCreche.style.display = 'none';
    }

    const rowCrechePcd = document.getElementById('row-creche-pcd');
    if (valorCrechePcd > 0) {
        rowCrechePcd.style.display = 'flex';
        document.getElementById('lbl-creche-pcd').textContent = formatCurrency(valorCrechePcd);
    } else {
        rowCrechePcd.style.display = 'none';
    }
    
    const row13_1 = document.getElementById('row-13-1');
    if (tipo13 === 1) {
        row13_1.style.display = 'flex';
        document.getElementById('lbl-13-1').textContent = formatCurrency(valor13_1);
    } else {
        row13_1.style.display = 'none';
    }

    const row13_2 = document.getElementById('row-13-2');
    if (tipo13 === 2) {
        row13_2.style.display = 'flex';
        document.getElementById('lbl-13-2').textContent = formatCurrency(valor13_2);
    } else {
        row13_2.style.display = 'none';
    }
    
    document.getElementById('lbl-total-vencimentos').textContent = formatCurrency(totalBrutoGeral);

    document.getElementById('lbl-spprev').textContent = `- ${formatCurrency(descontoSpprev)}`;
    document.getElementById('lbl-irpf').textContent = `- ${formatCurrency(descontoIrpf)}`;
    
    const rowSpprev13 = document.getElementById('row-spprev-13');
    const rowIrpf13 = document.getElementById('row-irpf-13');
    if (tipo13 === 2) {
        rowSpprev13.style.display = 'flex';
        rowIrpf13.style.display = 'flex';
        document.getElementById('lbl-spprev-13').textContent = `- ${formatCurrency(descontoSpprev13)}`;
        document.getElementById('lbl-irpf-13').textContent = `- ${formatCurrency(descontoIrpf13)}`;
    } else {
        rowSpprev13.style.display = 'none';
        rowIrpf13.style.display = 'none';
    }

    document.getElementById('lbl-total-descontos').textContent = `- ${formatCurrency(totalDescontos)}`;
    document.getElementById('lbl-salario-liquido').textContent = formatCurrency(salarioLiquido);
}

function calcularDescontoSpprev(baseSpprevInput) {
    let descontoSpprev = 0;
    let baseSpprev = baseSpprevInput; 

    // Tabela SPPREV 2025 Oficial
    const spprevFaixa1 = 1621.00;
    const spprevFaixa2 = 4174.58;
    const spprevFaixa3 = 8475.55;

    // Aplica o teto previdenciário (Trava de R$ 1.086,86)
    if (baseSpprev > spprevFaixa3) {
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

    // Trava de segurança para o valor exato solicitado
    if (descontoSpprev > 1086.86) {
        descontoSpprev = 1086.86;
    }

    return descontoSpprev;
}

function calcularDescontoIrpf(totalTributavel, descontoSpprev, dependentesIr) {
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
    return descontoIrpf;
}
